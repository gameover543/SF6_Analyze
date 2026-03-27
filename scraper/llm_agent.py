import json
import logging
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

class LLMAgent:
    """LLMを活用したデータクリーニング・欠損補完・フォールバック抽出"""
    
    def __init__(self, config):
        self.config = config
        if not config.google_api_key:
            logger.warning("Google API Keyが設定されていません。LLM機能は無効です。")
            self.llm = None
        else:
            self.llm = ChatGoogleGenerativeAI(
                model=config.llm_model,
                temperature=0,
                google_api_key=config.google_api_key
            )

    async def clean_data(self, character_name: str, raw_data_json: str) -> dict:
        """抽出データの表記揺れ補正や異常値チェックを行う"""
        if not self.llm: return json.loads(raw_data_json)
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", "あなたは格闘ゲームのデータアナリストです。ストリートファイター6の技フレームデータを正規化してください。"),
            ("human", """以下の{character_name}のデータをJSON形式でクリーンアップしてください。
                - 表記揺れ（例: 立ちLP vs 立弱P）を「立弱P」のような形式に統一。
                - 数字は半角に変換。
                - 欠損値は推測せず、空文字のままにしてください。

                データ:
                {data}
            """)
        ])
        
        chain = prompt | self.llm | JsonOutputParser()
        try:
            result = await chain.ainvoke({"character_name": character_name, "data": raw_data_json})
            return result
        except Exception as e:
            logger.error(f"LLMクリーンアップに失敗: {e}")
            return json.loads(raw_data_json)

    async def fallback_extract(self, html: str, character_name: str) -> dict:
        """セレクタ解析が失敗した場合のHTML直接解析"""
        if not self.llm: return {"moves": []}
        
        # HTMLを軽量化（テーブル付近のみ）
        # 簡単のためここでは先頭から1万文字程度に制限
        snippet = html[:15000]
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", "あなたはHTML解析の専門家です。HTMLから技フレームデータをJSON形式で抽出してください。"),
            ("human", """以下のHTMLから、{character_name}の技データを抽出してください。
                対象フィールド: move_name, startup, active, recovery, on_hit, on_block, damage
                
                HTML:
                {html}
            """)
        ])
        
        chain = prompt | self.llm | JsonOutputParser()
        try:
            return await chain.ainvoke({"character_name": character_name, "html": snippet})
        except Exception as e:
            logger.error(f"LLMフォールバック抽出に失敗: {e}")
            return {"moves": []}
