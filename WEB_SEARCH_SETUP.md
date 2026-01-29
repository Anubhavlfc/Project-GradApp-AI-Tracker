# Web Search Setup for Research & Discovery Panel

The Research & Discovery Panel uses real-time web search to help you find graduate programs. To enable this feature, you need to configure a web search API.

## Why Web Search?

Instead of relying on a static database of universities, the web search integration:
- Fetches **real-time** information from the internet
- Finds **current** program details, rankings, and deadlines
- Discovers **new programs** as they're announced
- Provides **fresh** acceptance rates and requirements
- Then applies **intelligent filtering** based on your application history

## Setup Options

### Option 1: Serper.dev (Recommended - FREE tier available)

Serper.dev provides Google Search results through a simple API.

**Steps:**
1. Go to [https://serper.dev](https://serper.dev)
2. Sign up for a free account (no credit card required)
3. Get your API key from the dashboard
4. Add to `backend/.env`:
   ```
   SERPER_API_KEY=your_api_key_here
   ```

**Free Tier:** 2,500 searches/month

### Option 2: Google Custom Search API

Use Google's official Custom Search API.

**Steps:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Custom Search API**
4. Create credentials (API Key)
5. Create a Custom Search Engine at [https://programmablesearchengine.google.com](https://programmablesearchengine.google.com)
   - Set it to search the **entire web**
   - Copy the Search Engine ID (cx)
6. Add to `backend/.env`:
   ```
   GOOGLE_API_KEY=your_google_api_key_here
   GOOGLE_CX=your_search_engine_id_here
   ```

**Free Tier:** 100 searches/day

## Testing Your Setup

1. Add your API key to `backend/.env`
2. Restart the backend server:
   ```bash
   cd backend
   python main.py
   ```
3. Open the frontend and navigate to the Research & Discovery Panel
4. Try searching for "Stanford Computer Science" or any university
5. You should see real-time results from the web!

## How It Works

1. **You search:** Type a university name, program, or field (e.g., "MIT", "Machine Learning programs", "Stanford CS")

2. **Web search:** The system searches the internet for:
   - `"[your query] graduate program MS"`
   - Latest program information
   - Admission details
   - Rankings and requirements

3. **Smart filtering:** Results are filtered based on:
   - Your previous university choices
   - Programs you're interested in
   - Degree types you prefer (MS/PhD)
   - Your application tier strategy

4. **Live results:** You get fresh, real-time data directly from the web!

## Fallback Mode

If no web search API is configured, the system will use a limited fallback database with basic university information. This works offline but has less comprehensive and less current data.

## Privacy & Usage

- All searches are performed server-side
- Your search queries are sent to the search API provider
- No personal application data is shared with search providers
- Only search queries are transmitted

## Cost Considerations

Both Serper.dev and Google Custom Search offer generous free tiers that should be sufficient for personal use:
- **Serper.dev:** 2,500 free searches/month (~83 per day)
- **Google:** 100 free searches/day (~3,000 per month)

For a typical user researching programs, this is more than enough!

## Troubleshooting

### "No results found"
- Check your API key is correctly set in `.env`
- Verify the backend server was restarted after adding the key
- Check backend logs for error messages

### "Search failed"
- Ensure you have internet connectivity
- Verify your API key is valid and not expired
- Check you haven't exceeded your API quota

### Backend logs show "No web search API configured"
- Double-check your `.env` file has the API key
- Ensure there are no typos in the environment variable names
- Restart the backend server after adding keys

## Support

For issues with:
- **Serper API:** [https://serper.dev/docs](https://serper.dev/docs)
- **Google Custom Search:** [https://developers.google.com/custom-search](https://developers.google.com/custom-search)
