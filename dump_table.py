import asyncio
import json
from playwright.async_api import async_playwright
from config import ScraperConfig
from auth import AuthManager
from bs4 import BeautifulSoup

async def dump_table():
    config = ScraperConfig()
    auth = AuthManager(config)
    
    async with async_playwright() as p:
        context = await auth.get_authenticated_context(p)
        page = await context.new_page()
        
        url = "https://www.streetfighter.com/6/ja-jp/character/ryu/frame"
        print(f"Loading {url}...")
        await page.goto(url, wait_until="networkidle")
        
        # Wait for table
        await page.wait_for_selector("table", timeout=10000)
        content = await page.content()
        soup = BeautifulSoup(content, "html.parser")
        
        table = soup.find("table")
        if not table:
            print("Table not found")
            return
            
        rows = table.find_all("tr")
        with open("table_dump.txt", "w", encoding="utf-8") as f:
            for i, row in enumerate(rows[:10]):
                cells = row.find_all(["th", "td"])
                row_data = [f"[{j}]:{cell.get_text(strip=True)}" for j, cell in enumerate(cells)]
                f.write(f"Row {i}: {' | '.join(row_data)}\n")
        
        print("Table structure dumped to table_dump.txt")
        await context.close()

if __name__ == "__main__":
    asyncio.run(dump_table())
