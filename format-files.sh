#!/bin/bash

# Simple formatter based on Prettier rules
# Rules: semi: true, singleQuote: true, tabWidth: 2, useTabs: false, printWidth: 100

format_file() {
    local file="$1"
    echo "Formatting $file..."
    
    # Apply basic formatting rules
    sed -i \
        -e 's/"/'"'"'/g; s/'"'"'/'"'"'/g' \
        -e 's/;$/;/g' \
        -e 's/\t/  /g' \
        -e 's/  \+$//' \
        "$file"
}

# Format all TypeScript files
find src tests -name "*.ts" | while read file; do
    format_file "$file"
done

echo "Formatting complete!"