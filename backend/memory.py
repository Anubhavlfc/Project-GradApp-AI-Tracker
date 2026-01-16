"""
Long-term memory handling using ChromaDB for semantic search.
Stores conversation history, essay drafts, and enables context retrieval.
"""

import chromadb
from chromadb.config import Settings
from datetime import datetime
from typing import List, Dict, Any, Optional
import json
import hashlib


# Initialize ChromaDB client with persistent storage
chroma_client = chromadb.Client(Settings(
    chroma_db_impl="duckdb+parquet",
    persist_directory="./chroma_data",
    anonymized_telemetry=False
))


def get_or_create_collection(name: str):
    """Get or create a ChromaDB collection."""
    return chroma_client.get_or_create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"}
    )


# Collections
conversations_collection = get_or_create_collection("conversations")
essays_collection = get_or_create_collection("essays")
research_collection = get_or_create_collection("program_research")


def generate_id(content: str, prefix: str = "") -> str:
    """Generate a unique ID based on content hash."""
    hash_obj = hashlib.md5(content.encode())
    return f"{prefix}_{hash_obj.hexdigest()[:12]}_{datetime.now().strftime('%Y%m%d%H%M%S')}"


# Conversation Memory
def store_conversation(
    user_message: str,
    assistant_response: str,
    metadata: Optional[Dict[str, Any]] = None
) -> str:
    """Store a conversation turn in memory."""
    combined = f"User: {user_message}\nAssistant: {assistant_response}"
    doc_id = generate_id(combined, "conv")

    meta = {
        "timestamp": datetime.now().isoformat(),
        "type": "conversation"
    }
    if metadata:
        meta.update(metadata)

    conversations_collection.add(
        documents=[combined],
        metadatas=[meta],
        ids=[doc_id]
    )

    return doc_id


def search_conversations(
    query: str,
    n_results: int = 5,
    filter_metadata: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """Search for relevant past conversations."""
    results = conversations_collection.query(
        query_texts=[query],
        n_results=n_results,
        where=filter_metadata
    )

    conversations = []
    if results['documents'] and results['documents'][0]:
        for i, doc in enumerate(results['documents'][0]):
            conversations.append({
                "content": doc,
                "metadata": results['metadatas'][0][i] if results['metadatas'] else {},
                "distance": results['distances'][0][i] if results['distances'] else None
            })

    return conversations


def get_recent_conversations(n: int = 10) -> List[Dict[str, Any]]:
    """Get the most recent conversations."""
    results = conversations_collection.get(
        limit=n,
        include=["documents", "metadatas"]
    )

    conversations = []
    if results['documents']:
        for i, doc in enumerate(results['documents']):
            conversations.append({
                "content": doc,
                "metadata": results['metadatas'][i] if results['metadatas'] else {}
            })

    # Sort by timestamp (newest first)
    conversations.sort(
        key=lambda x: x.get('metadata', {}).get('timestamp', ''),
        reverse=True
    )

    return conversations[:n]


# Essay Memory
def store_essay(
    essay_content: str,
    school_name: str,
    program_name: str,
    essay_type: str = "sop",
    version: int = 1,
    metadata: Optional[Dict[str, Any]] = None
) -> str:
    """Store an essay draft in memory for semantic search."""
    doc_id = generate_id(essay_content, f"essay_{school_name}")

    meta = {
        "timestamp": datetime.now().isoformat(),
        "school_name": school_name,
        "program_name": program_name,
        "essay_type": essay_type,
        "version": version,
        "word_count": len(essay_content.split())
    }
    if metadata:
        meta.update(metadata)

    essays_collection.add(
        documents=[essay_content],
        metadatas=[meta],
        ids=[doc_id]
    )

    return doc_id


def search_essays(
    query: str,
    n_results: int = 3,
    school_name: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Search for relevant essay content."""
    where_filter = {"school_name": school_name} if school_name else None

    results = essays_collection.query(
        query_texts=[query],
        n_results=n_results,
        where=where_filter
    )

    essays = []
    if results['documents'] and results['documents'][0]:
        for i, doc in enumerate(results['documents'][0]):
            essays.append({
                "content": doc,
                "metadata": results['metadatas'][0][i] if results['metadatas'] else {},
                "distance": results['distances'][0][i] if results['distances'] else None
            })

    return essays


# Program Research Memory
def store_research(
    school_name: str,
    program_name: str,
    research_content: str,
    metadata: Optional[Dict[str, Any]] = None
) -> str:
    """Store program research information."""
    doc_id = generate_id(research_content, f"research_{school_name}")

    meta = {
        "timestamp": datetime.now().isoformat(),
        "school_name": school_name,
        "program_name": program_name
    }
    if metadata:
        meta.update(metadata)

    research_collection.add(
        documents=[research_content],
        metadatas=[meta],
        ids=[doc_id]
    )

    return doc_id


def search_research(
    query: str,
    n_results: int = 5,
    school_name: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Search for relevant program research."""
    where_filter = {"school_name": school_name} if school_name else None

    results = research_collection.query(
        query_texts=[query],
        n_results=n_results,
        where=where_filter
    )

    research = []
    if results['documents'] and results['documents'][0]:
        for i, doc in enumerate(results['documents'][0]):
            research.append({
                "content": doc,
                "metadata": results['metadatas'][0][i] if results['metadatas'] else {},
                "distance": results['distances'][0][i] if results['distances'] else None
            })

    return research


def get_research_for_school(school_name: str) -> List[Dict[str, Any]]:
    """Get all research stored for a specific school."""
    results = research_collection.get(
        where={"school_name": school_name},
        include=["documents", "metadatas"]
    )

    research = []
    if results['documents']:
        for i, doc in enumerate(results['documents']):
            research.append({
                "content": doc,
                "metadata": results['metadatas'][i] if results['metadatas'] else {}
            })

    return research


# Context Building for LLM
def build_context(
    query: str,
    include_conversations: bool = True,
    include_essays: bool = True,
    include_research: bool = True,
    max_items: int = 5
) -> str:
    """Build a context string from relevant memories for the LLM."""
    context_parts = []

    if include_conversations:
        convos = search_conversations(query, n_results=max_items)
        if convos:
            context_parts.append("=== Relevant Past Conversations ===")
            for conv in convos:
                context_parts.append(conv['content'])
                context_parts.append("---")

    if include_essays:
        essays = search_essays(query, n_results=max_items)
        if essays:
            context_parts.append("=== Relevant Essay Content ===")
            for essay in essays:
                meta = essay.get('metadata', {})
                context_parts.append(
                    f"School: {meta.get('school_name', 'Unknown')}, "
                    f"Type: {meta.get('essay_type', 'Unknown')}"
                )
                # Truncate long essays
                content = essay['content']
                if len(content) > 500:
                    content = content[:500] + "..."
                context_parts.append(content)
                context_parts.append("---")

    if include_research:
        research = search_research(query, n_results=max_items)
        if research:
            context_parts.append("=== Relevant Program Research ===")
            for res in research:
                meta = res.get('metadata', {})
                context_parts.append(
                    f"School: {meta.get('school_name', 'Unknown')}, "
                    f"Program: {meta.get('program_name', 'Unknown')}"
                )
                content = res['content']
                if len(content) > 500:
                    content = content[:500] + "..."
                context_parts.append(content)
                context_parts.append("---")

    return "\n".join(context_parts)


def clear_all_memory():
    """Clear all stored memories (use with caution)."""
    global conversations_collection, essays_collection, research_collection

    chroma_client.delete_collection("conversations")
    chroma_client.delete_collection("essays")
    chroma_client.delete_collection("program_research")

    conversations_collection = get_or_create_collection("conversations")
    essays_collection = get_or_create_collection("essays")
    research_collection = get_or_create_collection("program_research")


def get_memory_stats() -> Dict[str, int]:
    """Get statistics about stored memories."""
    return {
        "conversations": conversations_collection.count(),
        "essays": essays_collection.count(),
        "research": research_collection.count()
    }
