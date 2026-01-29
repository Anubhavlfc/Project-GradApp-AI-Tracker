"""
GradTrack AI - Memory Manager

This module implements long-term memory for the AI agent using two systems:

1. SEMANTIC MEMORY (ChromaDB/Vector Store)
   - Stores conversation summaries
   - Stores essay drafts
   - Enables similarity-based retrieval
   - Allows the agent to "remember" past conversations

2. STRUCTURED MEMORY (SQLite - see database.py)
   - Stores applications, profile, interview notes
   - Provides exact data retrieval

The memory manager provides a unified interface for:
- Storing new memories
- Retrieving relevant memories for a query
- Summarizing conversations for storage
"""

import os
import json
from datetime import datetime
from typing import List, Dict, Any, Optional

# For vector storage, we use ChromaDB
# If not available, we fall back to a simple in-memory implementation
try:
    import chromadb
    from chromadb.config import Settings
    CHROMADB_AVAILABLE = True
except ImportError:
    CHROMADB_AVAILABLE = False
    print("⚠️ ChromaDB not installed. Using in-memory fallback for semantic search.")

# For embeddings, we can use sentence-transformers or OpenAI
# This implementation provides both options
try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False


class MemoryManager:
    """
    Manages long-term memory for the GradTrack AI agent.
    
    This class provides:
    - Semantic storage and retrieval using vector embeddings
    - Conversation history management
    - Memory persistence across sessions
    
    The memory system enables the agent to:
    - Remember what the user said in previous conversations
    - Recall relevant context when answering questions
    - Learn user preferences over time
    """
    
    # Memory types for organization
    MEMORY_TYPES = {
        "conversation": "User conversations and agent responses",
        "essay": "Essay drafts and feedback",
        "preference": "User preferences and goals",
        "note": "General notes and observations"
    }
    
    def __init__(self, persist_directory: str = None):
        """
        Initialize the memory manager.
        
        Args:
            persist_directory: Directory to persist ChromaDB data
        """
        self.persist_directory = persist_directory or os.path.join(
            os.path.dirname(__file__), "memory_store"
        )
        self.client = None
        self.collection = None
        self.embedder = None
        self.conversation_buffer = []  # In-memory buffer for current session
        self._fallback_memories = []  # Fallback if ChromaDB not available
        
    def initialize(self):
        """
        Initialize the memory systems.
        Called on application startup.
        """
        # Create persist directory if needed
        os.makedirs(self.persist_directory, exist_ok=True)
        
        if CHROMADB_AVAILABLE:
            self._initialize_chromadb()
        else:
            self._initialize_fallback()
        
        # Initialize embedder if available (skip on startup for faster loading)
        if SENTENCE_TRANSFORMERS_AVAILABLE:
            try:
                # Defer model loading to avoid slow startup
                self.embedder = None
                print("⚠️ Sentence transformer deferred (memory-lite mode)")
            except Exception as e:
                print(f"⚠️ Could not load sentence transformer: {e}")
        
        print("✅ Memory systems initialized")
    
    def _initialize_chromadb(self):
        """Initialize ChromaDB for vector storage"""
        try:
            self.client = chromadb.Client(Settings(
                chroma_db_impl="duckdb+parquet",
                persist_directory=self.persist_directory,
                anonymized_telemetry=False
            ))
            
            # Get or create the main collection
            self.collection = self.client.get_or_create_collection(
                name="gradtrack_memories",
                metadata={"description": "Long-term memories for GradTrack AI"}
            )
            
            print(f"✅ ChromaDB initialized with {self.collection.count()} memories")
        except Exception as e:
            print(f"⚠️ ChromaDB initialization failed: {e}")
            self._initialize_fallback()
    
    def _initialize_fallback(self):
        """Initialize fallback in-memory storage"""
        # Load from file if exists
        fallback_file = os.path.join(self.persist_directory, "fallback_memories.json")
        if os.path.exists(fallback_file):
            try:
                with open(fallback_file, 'r') as f:
                    self._fallback_memories = json.load(f)
                print(f"✅ Loaded {len(self._fallback_memories)} memories from fallback storage")
            except Exception as e:
                print(f"⚠️ Could not load fallback memories: {e}")
                self._fallback_memories = []
        else:
            self._fallback_memories = []
    
    def _save_fallback(self):
        """Save fallback memories to file"""
        fallback_file = os.path.join(self.persist_directory, "fallback_memories.json")
        try:
            with open(fallback_file, 'w') as f:
                json.dump(self._fallback_memories, f, indent=2)
        except Exception as e:
            print(f"⚠️ Could not save fallback memories: {e}")
    
    # ============================================
    # Memory Storage
    # ============================================
    
    def store_memory(
        self,
        content: str,
        memory_type: str = "conversation",
        metadata: Dict[str, Any] = None,
        session_id: str = "default"
    ) -> str:
        """
        Store a new memory.
        
        Args:
            content: The text content to store
            memory_type: Type of memory (conversation, essay, preference, note)
            metadata: Additional metadata to store with the memory
            session_id: Session identifier for grouping
            
        Returns:
            The ID of the stored memory
        """
        memory_id = f"{memory_type}_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
        
        full_metadata = {
            "type": memory_type,
            "session_id": session_id,
            "timestamp": datetime.now().isoformat(),
            **(metadata or {})
        }
        
        if self.collection is not None:
            # Use ChromaDB
            try:
                self.collection.add(
                    documents=[content],
                    metadatas=[full_metadata],
                    ids=[memory_id]
                )
            except Exception as e:
                print(f"⚠️ Error storing memory in ChromaDB: {e}")
                self._store_fallback(memory_id, content, full_metadata)
        else:
            # Use fallback
            self._store_fallback(memory_id, content, full_metadata)
        
        return memory_id
    
    def _store_fallback(self, memory_id: str, content: str, metadata: Dict):
        """Store memory in fallback storage"""
        self._fallback_memories.append({
            "id": memory_id,
            "content": content,
            "metadata": metadata
        })
        self._save_fallback()
    
    def store_conversation(
        self,
        user_message: str,
        agent_response: str,
        tools_used: List[str] = None,
        session_id: str = "default"
    ):
        """
        Store a conversation turn.
        
        This creates a summary of the conversation for semantic search
        and adds it to the conversation buffer.
        """
        # Create a combined summary for storage
        summary = f"User: {user_message}\nAssistant: {agent_response}"
        
        metadata = {
            "user_message": user_message[:500],  # Truncate for metadata
            "agent_response": agent_response[:500],
            "tools_used": ",".join(tools_used) if tools_used else ""
        }
        
        # Store in vector DB
        memory_id = self.store_memory(
            content=summary,
            memory_type="conversation",
            metadata=metadata,
            session_id=session_id
        )
        
        # Add to conversation buffer for current session context
        self.conversation_buffer.append({
            "role": "user",
            "content": user_message
        })
        self.conversation_buffer.append({
            "role": "assistant", 
            "content": agent_response
        })
        
        # Keep buffer manageable (last 20 messages)
        if len(self.conversation_buffer) > 20:
            self.conversation_buffer = self.conversation_buffer[-20:]
        
        return memory_id
    
    def store_essay(
        self,
        essay_content: str,
        school: Optional[str] = None,
        program: Optional[str] = None,
        version: int = 1,
        session_id: str = "default"
    ):
        """Store an essay draft for later retrieval"""
        metadata = {
            "school": school or "unknown",
            "program": program or "unknown",
            "version": version,
            "word_count": len(essay_content.split())
        }
        
        return self.store_memory(
            content=essay_content,
            memory_type="essay",
            metadata=metadata,
            session_id=session_id
        )
    
    def store_preference(
        self,
        preference: str,
        category: str = "general",
        session_id: str = "default"
    ):
        """Store a user preference"""
        metadata = {"category": category}
        
        return self.store_memory(
            content=preference,
            memory_type="preference",
            metadata=metadata,
            session_id=session_id
        )
    
    # ============================================
    # Memory Retrieval
    # ============================================
    
    def search_similar(
        self,
        query: str,
        limit: int = 5,
        memory_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for memories similar to the query.
        
        This uses semantic similarity to find relevant past memories.
        
        Args:
            query: The search query
            limit: Maximum number of results
            memory_type: Optional filter by memory type
            
        Returns:
            List of matching memories with content and metadata
        """
        if self.collection is not None:
            try:
                # Build filter if memory_type specified
                where_filter = {"type": memory_type} if memory_type else None
                
                results = self.collection.query(
                    query_texts=[query],
                    n_results=limit,
                    where=where_filter
                )
                
                # Format results
                memories = []
                if results and results['documents'] and len(results['documents']) > 0:
                    for i, doc in enumerate(results['documents'][0]):
                        memory = {
                            "content": doc,
                            "metadata": results['metadatas'][0][i] if results['metadatas'] else {},
                            "id": results['ids'][0][i] if results['ids'] else None,
                            "distance": results['distances'][0][i] if results.get('distances') else None
                        }
                        memories.append(memory)
                
                return memories
            except Exception as e:
                print(f"⚠️ Error searching ChromaDB: {e}")
                return self._search_fallback(query, limit, memory_type)
        else:
            return self._search_fallback(query, limit, memory_type)
    
    def _search_fallback(
        self,
        query: str,
        limit: int = 5,
        memory_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Fallback search using simple text matching.
        Less accurate than vector search but works without dependencies.
        """
        query_lower = query.lower()
        query_words = set(query_lower.split())
        
        scored_memories = []
        for memory in self._fallback_memories:
            # Filter by type if specified
            if memory_type and memory.get("metadata", {}).get("type") != memory_type:
                continue
            
            # Simple scoring based on word overlap
            content_lower = memory["content"].lower()
            content_words = set(content_lower.split())
            
            # Calculate overlap score
            overlap = len(query_words & content_words)
            if overlap > 0:
                score = overlap / len(query_words)
                scored_memories.append((score, memory))
        
        # Sort by score and return top results
        scored_memories.sort(key=lambda x: x[0], reverse=True)
        
        return [
            {
                "content": m["content"],
                "metadata": m["metadata"],
                "id": m["id"],
                "score": s
            }
            for s, m in scored_memories[:limit]
        ]
    
    def get_recent_conversations(self, limit: int = 10) -> List[Dict]:
        """Get recent conversations from memory"""
        if self.collection is not None:
            try:
                results = self.collection.get(
                    where={"type": "conversation"},
                    limit=limit
                )
                
                if results and results['documents']:
                    conversations = []
                    for i, doc in enumerate(results['documents']):
                        conversations.append({
                            "content": doc,
                            "metadata": results['metadatas'][i] if results['metadatas'] else {}
                        })
                    # Sort by timestamp (newest first)
                    conversations.sort(
                        key=lambda x: x.get("metadata", {}).get("timestamp", ""),
                        reverse=True
                    )
                    return conversations[:limit]
            except Exception as e:
                print(f"⚠️ Error getting recent conversations: {e}")
        
        # Fallback
        conversations = [
            m for m in self._fallback_memories 
            if m.get("metadata", {}).get("type") == "conversation"
        ]
        conversations.sort(
            key=lambda x: x.get("metadata", {}).get("timestamp", ""),
            reverse=True
        )
        return conversations[:limit]
    
    def get_conversation_buffer(self) -> List[Dict]:
        """Get the current session's conversation buffer"""
        return self.conversation_buffer.copy()
    
    def clear_conversation_buffer(self):
        """Clear the conversation buffer (start fresh)"""
        self.conversation_buffer = []
    
    # ============================================
    # Context Building for Agent
    # ============================================
    
    def get_relevant_context(
        self,
        query: str,
        include_recent: bool = True,
        include_essays: bool = True,
        include_preferences: bool = True,
        max_tokens: int = 2000
    ) -> str:
        """
        Build relevant context for the agent based on the user's query.
        
        This retrieves:
        - Similar past conversations
        - Relevant essay content
        - User preferences
        
        Returns formatted context string for the agent prompt.
        """
        context_parts = []
        estimated_tokens = 0
        
        # Add recent conversation buffer
        if include_recent and self.conversation_buffer:
            recent = self.conversation_buffer[-6:]  # Last 3 exchanges
            if recent:
                context_parts.append("=== Recent Conversation ===")
                for msg in recent:
                    role = "User" if msg["role"] == "user" else "You"
                    content = msg["content"][:300]  # Truncate long messages
                    context_parts.append(f"{role}: {content}")
                estimated_tokens += sum(len(p.split()) for p in context_parts) * 1.3
        
        # Search for similar memories
        if estimated_tokens < max_tokens:
            similar = self.search_similar(query, limit=3, memory_type="conversation")
            if similar:
                context_parts.append("\n=== Related Past Conversations ===")
                for mem in similar:
                    if estimated_tokens >= max_tokens:
                        break
                    content = mem["content"][:400]
                    context_parts.append(content)
                    estimated_tokens += len(content.split()) * 1.3
        
        # Add preferences if relevant
        if include_preferences and estimated_tokens < max_tokens:
            prefs = self.search_similar(query, limit=2, memory_type="preference")
            if prefs:
                context_parts.append("\n=== User Preferences ===")
                for pref in prefs:
                    if estimated_tokens >= max_tokens:
                        break
                    context_parts.append(pref["content"][:200])
                    estimated_tokens += len(pref["content"].split()) * 1.3
        
        return "\n".join(context_parts)
    
    # ============================================
    # Statistics and Debugging
    # ============================================
    
    def get_memory_stats(self) -> Dict[str, Any]:
        """Get statistics about stored memories"""
        if self.collection is not None:
            try:
                total = self.collection.count()
                return {
                    "total_memories": total,
                    "storage": "chromadb",
                    "persist_directory": self.persist_directory
                }
            except:
                pass
        
        return {
            "total_memories": len(self._fallback_memories),
            "storage": "fallback",
            "persist_directory": self.persist_directory
        }
