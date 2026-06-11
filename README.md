# Co-op Statement Digitiser

A vibe-coded tool for digitising Co-op bank statements. Built to extract transaction data from PDF statements and scanned images into structured JSON.

## Setup

```bash
yarn install
cp .env.example .env  # Add your Anthropic API key
```

## Usage

1. Place your source PDFs and screenshots in the `input/` folder using the naming format `[account]-[number].[ext]` (e.g., `current-001.pdf`, `isa-012.png`)
2. Run the development server:
   ```bash
   yarn dev
   ```
3. Open the UI and work through each statement:
   - Fill out the summary fields (statement date, number, opening/closing balance)
   - Use AI Scan to automatically extract transaction data from images and PDFs
   - Review and correct any extraction errors
   - Sign off each field once verified
4. Once all statements are complete, run the export scripts to generate your required output format:
   ```bash
   yarn megistus-export
   ```

## How It Works

The digitiser reads source files from `input/` and creates corresponding JSON files with extracted data. Each JSON file contains:
- Summary information (dates, balances, statement number)
- Transaction list (date, description, money in/out, balance)
- Validation checks
- Sign-off tracking for quality control

The UI provides a side-by-side view of the source document and extracted data, making it easy to verify accuracy.
