from __future__ import annotations
from typing import Optional, List, Dict
import os
import re
import requests
from . import db
from . import settings

# Minimal, safe RAG handler with optional LLM synthesis (Mistral) when configured.
# - Grounded answers only, citing sources
# - Refuses personal legal advice
# - Returns structured JSON: answer, sources, intent

SENSITIVE_PATTERNS = [
    re.compile(r"\b(personal|specific) legal advice\b", re.I),
    re.compile(r"\brepresent me\b", re.I),
    re.compile(r"\bhow do I win\b", re.I),
]

DISCLAIMER = (
    "I can provide general information from official DoJ documents only. "
    "I cannot provide personal legal advice. For case-specific guidance, please consult an authorized legal professional or official DoJ helpdesk."
)

SYSTEM_PROMPT = (
    "You are a safety-first legal information assistant for the Department of Justice (India).\n"
    "STRICT RULES:\n"
    "- Answer ONLY using the provided document context. If the answer is not in context, say you cannot find it.\n"
    "- Always include a short, clear answer first, then a bullet list of key citations by title if available.\n"
    "- DO NOT provide personal or case-specific legal advice. If asked, refuse and provide official help channels.\n"
    "- Keep language simple and accessible; avoid legal jargon unless cited.\n"
    "- Respond in the user's requested language when provided.\n"
    "- Add the note: 'Information only — not legal advice.' at the end."
)


def _detect_sensitive(query: str) -> bool:
    return any(p.search(query) for p in SENSITIVE_PATTERNS)


def _build_sources(results: List[Dict]) -> List[Dict]:
    sources = []
    for r in results:
        meta = r.get("metadata", {})
        sources.append({
            "id": r.get("id"),
            "title": meta.get("title") or meta.get("filename") or "Document",
            "score": r.get("score"),
        })
    return sources


def _compose_context(results: List[Dict], max_chars: int = 4000) -> str:
    parts = []
    used = 0
    for r in results:
        snippet = r.get("snippet", "")
        title = (r.get("metadata", {}) or {}).get("title") or (r.get("metadata", {}) or {}).get("filename") or "Document"
        block = f"Title: {title}\nSnippet: {snippet}\n---\n"
        if used + len(block) > max_chars:
            break
        parts.append(block)
        used += len(block)
    return "\n".join(parts)


def _llm_answer(query: str, results: List[Dict], language: Optional[str]) -> Optional[str]:
    if not settings.USE_LLM or not settings.MISTRAL_API_KEY:
        return None
    
    # Prepare context from documents if available, otherwise work without context
    context = _compose_context(results) if results else None
    
    # Language-specific system prompts
    language_prompts = {
        'hi-IN': (
            "आप भारत के न्याय विभाग के लिए एक सहायक AI हैं।\n"
            "निर्देश:\n"
            "- यदि दस्तावेज़ संदर्भ दिया गया है, तो इसका उपयोग करके सटीक उत्तर दें और स्रोतों का हवाला दें।\n"
            "- यदि कोई दस्तावेज़ उपलब्ध नहीं है, तो सामान्य उपयोगी जानकारी प्रदान करें।\n"
            "- हमेशा व्यावसायिक, स्पष्ट और सहायक रहें।\n"
            "- कानूनी प्रश्नों के लिए, सामान्य जानकारी दें लेकिन हमेशा अस्वीकरण जोड़ें।\n"
            "- प्रतिक्रिया संक्षिप्त लेकिन जानकारीपूर्ण रखें।\n"
            "- हमेशा अंत में यह जोड़ें: 'केवल जानकारी — कानूनी सलाह नहीं।'"
        ),
        'en-IN': (
            "You are a helpful legal assistant lawyer for poor people in India who don't know their rights and laws.\n"
            "Your purpose is to help common people understand Indian laws and rights in simple, easy language.\n"
            "INSTRUCTIONS:\n"
            "- Act like a friendly lawyer who explains complex legal concepts in simple terms.\n"
            "- Focus on Indian laws, constitutional rights, and legal protections for common people.\n"
            "- Use simple language that poor and uneducated people can easily understand.\n"
            "- Provide practical legal advice and explain rights in everyday situations.\n"
            "- If document context is provided, use it to give accurate legal information.\n"
            "- Always include important legal rights and protections relevant to their situation.\n"
            "- Give actionable advice on what they can do to protect their rights.\n"
            "- Be compassionate and understanding of their situation.\n"
            "- FOR CRIMINAL CASES: Always mention relevant IPC sections, punishments, and years of imprisonment.\n"
            "- Explain what sections apply, what punishment they carry, and how many years jail time.\n"
            "- Provide complete legal information including bail procedures and legal options.\n"
            "- Always end with: 'This is general legal information, not specific legal advice. For serious matters, consult a lawyer.'"
        ),
        'bn-IN': (
            "আপনি ভারতের বিচার বিভাগের জন্য একটি সহায়ক AI।\n"
            "নির্দেশাবলী:\n"
            "- যদি নথি প্রসঙ্গ প্রদান করা হয়, তাহলে সঠিকভাবে উত্তর দিন এবং উৎস উল্লেখ করুন।\n"
            "- যদি কোন নথি পাওয়া না যায়, তাহলে সাধারণ উপকারী তথ্য প্রদান করুন।\n"
            "- সর্বদা পেশাদার, স্পষ্ট এবং সহায়ক থাকুন।\n"
            "- আইনী প্রশ্নের জন্য, সাধারণ তথ্য দিন কিন্তু সর্বদা দাবিত্যাগ যোগ করুন।\n"
            "- প্রতিক্রিয়া সংক্ষিপ্ত কিন্তু তথ্যবহুল রাখুন।\n"
            "- সর্বদা শেষে যোগ করুন: 'শুধুমাত্র তথ্য — আইনী পরামর্শ নয়।'"
        )
    }
    
    enhanced_system_prompt = language_prompts.get(language, language_prompts['en-IN'])
    
    # Combine system prompt and user query for Gemini
    if context:
        full_prompt = (
            f"{enhanced_system_prompt}\n\n"
            f"User language: {language or 'English'}\n"
            f"User question: {query}\n\n"
            f"Available document context:\n{context}"
        )
    else:
        # Pure Mistral API response without documents - act as lawyer for poor people
        pure_prompt = (
            "You are a helpful legal assistant lawyer for poor people in India who don't know their rights and laws.\n"
            "Your purpose is to help common people understand Indian laws and rights in simple, easy language.\n"
            "INSTRUCTIONS:\n"
            "- Act like a friendly lawyer who explains complex legal concepts in simple terms.\n"
            "- Focus on Indian laws, constitutional rights, and legal protections for common people.\n"
            "- Use simple language that poor and uneducated people can easily understand.\n"
            "- Provide practical legal advice and explain rights in everyday situations.\n"
            "- Always include important legal rights and protections relevant to their situation.\n"
            "- Give actionable advice on what they can do to protect their rights.\n"
            "- Be compassionate and understanding of their situation.\n"
            "- FOR CRIMINAL CASES: Always mention relevant IPC sections, punishments, and years of imprisonment.\n"
            "- Explain what sections apply, what punishment they carry, and how many years jail time.\n"
            "- Provide complete legal information including bail procedures and legal options.\n"
            "- Answer naturally as if you're having a conversation with someone who needs legal help.\n\n"
            f"User question: {query}"
        )
        full_prompt = pure_prompt
    
    try:
        # Mistral API endpoint
        url = "https://api.mistral.ai/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.MISTRAL_API_KEY}",
        }
        
        payload = {
            "model": settings.MISTRAL_MODEL,
            "messages": [
                {"role": "system", "content": full_prompt},
                {"role": "user", "content": query}
            ],
            "temperature": settings.MISTRAL_TEMPERATURE,
            "max_tokens": settings.MISTRAL_MAX_TOKENS,
        }
        
        # Add retry logic for rate limiting
        max_retries = 3
        for attempt in range(max_retries):
            resp = requests.post(
                url,
                headers=headers,
                json=payload,
                timeout=30,
            )
            
            if resp.status_code == 200:
                data = resp.json()
                choices = data.get("choices", [])
                if choices and len(choices) > 0:
                    message = choices[0].get("message", {})
                    content = message.get("content", "")
                    return content
            elif resp.status_code == 429:  # Rate limited
                if attempt < max_retries - 1:
                    print(f"Rate limited, retrying in 5 seconds...")
                    import time
                    time.sleep(5)
                    continue
            else:
                print(f"Mistral API error: {resp.status_code} - {resp.text}")
                break
        
        # If all retries fail, return a helpful response instead of None
        return "I'm here to help! Could you please rephrase your question or try again in a moment?"
    except Exception as e:
        print(f"Exception calling Mistral API: {e}")
        return "I'm here to help! Could you please rephrase your question or try again in a moment?"


def answer_query(query: str, session_id: Optional[str] = None, top_k: int = 5, language: Optional[str] = None) -> Dict:
    # Sensitive / personal advice refusal
    if _detect_sensitive(query):
        return {
            "answer": f"{DISCLAIMER}",
            "sources": [],
            "intent": "sensitive_refusal",
        }

    # Retrieve candidate passages
    results = db.search(query, top_k=top_k)

    # Always use Mistral API if available - like ChatGPT, even without documents
    if settings.USE_LLM and settings.MISTRAL_API_KEY:
        llm_response = _llm_answer(query, results, language)
        if llm_response and llm_response.strip():
            return {
                "answer": llm_response.strip(),
                "sources": _build_sources(results) if results else [],
                "intent": "ai_response",
            }

    # Fallback: Only if no Gemini API available
    if not results:
        return {
            "answer": "I couldn't find an answer in the available DoJ documents. Please try rephrasing or provide more context.",
            "sources": [],
            "intent": "no_match",
        }

    # Final fallback: Use document snippets directly
    snippets = [r.get("snippet", "") for r in results if r.get("snippet")]
    joined = "\n\n".join(f"- {s[:300]}" for s in snippets)
    answer = (
        "Based on the following DoJ document excerpts, here is a concise answer: \n\n"
        f"{joined}\n\n"
        "Note: Information only — not legal advice."
    )

    return {
        "answer": answer,
        "sources": _build_sources(results),
        "intent": "document_retrieval",
    }
