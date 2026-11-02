#!/usr/bin/env bash

# Usage: ./filter_by_degree.sh input.csv output.csv [min_degree]
# Default min_degree = 10

infile="$1"
outfile="$2"
min_degree="${3:-10}"

if [ -z "$infile" ] || [ -z "$outfile" ]; then
  echo "Usage: $0 input.csv output.csv [min_degree]" >&2
  exit 1
fi

tmp_counts="$(mktemp)"

# 1) Count how many times each node appears (as source or target)
awk -F',' -v OFS=',' '
  NR == 1 { next }  # skip header
  {
    # Trim leading/trailing whitespace just in case
    gsub(/^[ \t]+|[ \t]+$/, "", $1)
    gsub(/^[ \t]+|[ \t]+$/, "", $2)

    count[$1]++
    count[$2]++
  }
  END {
    for (n in count) {
      print n, count[n]
    }
  }
' "$infile" > "$tmp_counts"

# 2) Filter original CSV using the counts
awk -F',' -v OFS=',' -v MIN="$min_degree" '
  NR == FNR {
    # First file: node counts
    count[$1] = $2
    next
  }

  NR == 1 {
    # Header line
    print
    next
  }

  {
    # Trim again to match keys in count[]
    gsub(/^[ \t]+|[ \t]+$/, "", $1)
    gsub(/^[ \t]+|[ \t]+$/, "", $2)

    if (count[$1] >= MIN && count[$2] >= MIN) {
      print
    }
  }
' "$tmp_counts" "$infile" > "$outfile"

rm -f "$tmp_counts"
