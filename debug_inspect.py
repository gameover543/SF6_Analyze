import asyncio
from playwright.async_api import async_playwright
from config import ScraperConfig
from auth import AuthManager
from crawler import Crawler

async def inspect():
    config = ScraperConfig()
    auth = AuthManager(config)
    crawler = Crawler(config)
    
    async with async_playwright() as p:
        context = await auth.get_authenticated_context(p)
        page = await context.new_page()
        html = await crawler.scrape_character(page, {"name": "Ryu", "slug": "ryu"})
        with open("ryu_debug.html", "w", encoding="utf-8") as f:
            f.write(html)
        await context.close()

if __name__ == "__main__":
    asyncio.run(inspect())
