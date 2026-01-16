"""
GradTrack AI - ReAct Agent

This module implements the core AI agent using the ReAct (Reasoning + Acting) pattern.
The agent follows this loop:
1. OBSERVE: Receive user input and retrieve relevant memory
2. THINK: Reason about what action to take
3. ACT: Decide whether to call a tool or respond directly
4. OBSERVE: If tool called, observe the result
5. RESPOND: Generate final response to user

This is an EXPLICIT agent implementation - no magic frameworks.
The agent logic is clearly visible and debuggable.
"""

import os
import json
import re
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime

# Import OpenAI for LLM calls
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    print("⚠️ OpenAI package not installed. Agent will use mock responses.")

# Import our modules
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from mcp_tools import create_all_tools, get_all_tool_definitions


class GradTrackAgent:
    """
    The main AI agent for GradTrack.
    
    This agent:
    - Maintains conversation context
    - Decides when to use tools
    - Calls appropriate MCP tools
    - Generates helpful responses
    - Stores interactions in memory
    
    Architecture:
    - Uses ReAct pattern for reasoning
    - Explicitly separates reasoning from action
    - All tool calls are transparent and logged
    """
    
    # System prompt that defines agent behavior
    SYSTEM_PROMPT = """You are GradTrack AI, an intelligent assistant helping students manage their US graduate school applications.

You have access to the following tools:
{tool_descriptions}

When the user asks you to do something, think step by step:
1. First, understand what the user wants
2. Determine if you need to use a tool
3. If yes, decide which tool and what parameters
4. Use the tool result to formulate your response

IMPORTANT RULES:
- If the user wants to ADD, UPDATE, or CHECK applications, use the application_database tool
- If the user asks about DEADLINES, REQUIREMENTS, or SCHOOL INFO, use the program_research tool
- If the user shares an ESSAY or SOP, use the essay_analyzer tool
- If the user asks about TASKS, TO-DOS, or DEADLINES, use the calendar_todo tool
- Always be helpful, specific, and encouraging
- Remember context from the conversation

You are NOT a simple chatbot. You are an agentic AI that takes action and maintains state.

Current context about the user:
{user_context}

Today's date: {current_date}"""

    # Prompt for deciding whether to use a tool
    DECISION_PROMPT = """Based on the user's message, decide if you need to use a tool.

User message: "{user_message}"

Available tools:
1. application_database - For managing applications (add, update, delete, search, view)
2. program_research - For looking up school/program information
3. essay_analyzer - For analyzing Statement of Purpose essays
4. calendar_todo - For managing tasks and deadlines

Respond with a JSON object:
{{
    "use_tool": true/false,
    "tool_name": "tool name if using tool, null otherwise",
    "tool_params": {{parameters for the tool}},
    "reasoning": "brief explanation of your decision"
}}

If the user is just having a conversation or asking a general question, set use_tool to false.
If they want to perform an action or need specific information, use the appropriate tool."""

    def __init__(self, db_manager, memory_manager):
        """
        Initialize the agent with required dependencies.
        
        Args:
            db_manager: DatabaseManager instance for structured data
            memory_manager: MemoryManager instance for semantic memory
        """
        self.db = db_manager
        self.memory = memory_manager
        
        # Initialize OpenAI client
        self.client = None
        if OPENAI_AVAILABLE:
            api_key = os.getenv("OPENAI_API_KEY")
            if api_key:
                self.client = OpenAI(api_key=api_key)
                print("✅ OpenAI client initialized")
            else:
                print("⚠️ OPENAI_API_KEY not set. Agent will use mock responses.")
        
        # Initialize tools
        self.tools = create_all_tools(db_manager)
        self.tool_definitions = get_all_tool_definitions()
        
        # Reasoning trace for transparency
        self.last_reasoning_trace = []
    
    async def process_message(
        self,
        user_message: str,
        session_id: str = "default"
    ) -> Dict[str, Any]:
        """
        Process a user message through the ReAct loop.
        
        This is the main entry point for agent interaction.
        
        Steps:
        1. Retrieve relevant memory context
        2. Decide if tool is needed
        3. Execute tool if needed
        4. Generate response
        5. Store interaction in memory
        
        Args:
            user_message: The user's input message
            session_id: Session identifier for memory grouping
            
        Returns:
            Dict with response, tools_used, and reasoning_steps
        """
        self.last_reasoning_trace = []
        tools_used = []
        tool_results = []
        
        # ============================================
        # STEP 1: OBSERVE - Get context
        # ============================================
        self._trace("OBSERVE", "Retrieving relevant context from memory...")
        
        # Get memory context
        memory_context = self.memory.get_relevant_context(user_message)
        
        # Get current application state
        app_summary = self.db.get_summary_for_agent()
        
        self._trace("OBSERVE", f"Retrieved context: {len(memory_context)} chars from memory, {len(app_summary)} chars from database")
        
        # ============================================
        # STEP 2: THINK - Decide on action
        # ============================================
        self._trace("THINK", "Analyzing user intent and deciding on action...")
        
        tool_decision = await self._decide_tool_use(user_message, memory_context)
        
        self._trace("THINK", f"Decision: {'Use tool' if tool_decision['use_tool'] else 'Direct response'}")
        if tool_decision.get("reasoning"):
            self._trace("THINK", f"Reasoning: {tool_decision['reasoning']}")
        
        # ============================================
        # STEP 3: ACT - Execute tool if needed
        # ============================================
        if tool_decision["use_tool"]:
            tool_name = tool_decision["tool_name"]
            tool_params = tool_decision["tool_params"]
            
            self._trace("ACT", f"Executing tool: {tool_name}")
            self._trace("ACT", f"Parameters: {json.dumps(tool_params, indent=2)}")
            
            # Execute the tool
            tool_result = self._execute_tool(tool_name, tool_params)
            
            self._trace("OBSERVE", f"Tool result: {json.dumps(tool_result, indent=2)[:500]}...")
            
            tools_used.append(tool_name)
            tool_results.append({
                "tool": tool_name,
                "params": tool_params,
                "result": tool_result
            })
        
        # ============================================
        # STEP 4: RESPOND - Generate final response
        # ============================================
        self._trace("RESPOND", "Generating response to user...")
        
        response = await self._generate_response(
            user_message=user_message,
            memory_context=memory_context,
            app_summary=app_summary,
            tool_results=tool_results
        )
        
        # ============================================
        # STEP 5: STORE - Save interaction to memory
        # ============================================
        self._trace("STORE", "Saving interaction to long-term memory...")
        
        self.memory.store_conversation(
            user_message=user_message,
            agent_response=response,
            tools_used=tools_used,
            session_id=session_id
        )
        
        return {
            "response": response,
            "tools_used": tools_used,
            "reasoning_steps": self.last_reasoning_trace
        }
    
    async def _decide_tool_use(
        self,
        user_message: str,
        context: str
    ) -> Dict[str, Any]:
        """
        Decide whether to use a tool based on user message.
        
        Uses the LLM to analyze intent and determine if a tool is needed.
        Falls back to rule-based detection if LLM unavailable.
        """
        if self.client:
            # Use LLM for decision
            try:
                response = self.client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {"role": "system", "content": "You are a tool selection assistant. Respond only with valid JSON."},
                        {"role": "user", "content": self.DECISION_PROMPT.format(user_message=user_message)}
                    ],
                    temperature=0.1,
                    max_tokens=500
                )
                
                decision_text = response.choices[0].message.content.strip()
                
                # Parse JSON from response
                # Handle markdown code blocks
                if "```json" in decision_text:
                    decision_text = decision_text.split("```json")[1].split("```")[0]
                elif "```" in decision_text:
                    decision_text = decision_text.split("```")[1].split("```")[0]
                
                decision = json.loads(decision_text)
                return decision
                
            except Exception as e:
                self._trace("ERROR", f"LLM decision failed: {e}")
                return self._rule_based_decision(user_message)
        else:
            return self._rule_based_decision(user_message)
    
    def _rule_based_decision(self, user_message: str) -> Dict[str, Any]:
        """
        Rule-based fallback for tool selection.
        Used when LLM is unavailable.
        """
        message_lower = user_message.lower()
        
        # Check for application-related keywords
        app_keywords = ["add", "create", "new application", "track", "update", "status", 
                       "my applications", "delete", "remove", "list applications"]
        if any(kw in message_lower for kw in app_keywords):
            # Try to extract school and program
            action = "read"  # default
            if any(w in message_lower for w in ["add", "create", "new"]):
                action = "create"
            elif any(w in message_lower for w in ["update", "change", "move"]):
                action = "update"
            elif any(w in message_lower for w in ["delete", "remove"]):
                action = "delete"
            
            return {
                "use_tool": True,
                "tool_name": "application_database",
                "tool_params": {"action": action},
                "reasoning": "User wants to manage applications"
            }
        
        # Check for research-related keywords
        research_keywords = ["deadline", "requirement", "gre", "toefl", "tuition", 
                           "ranking", "faculty", "what does", "tell me about"]
        if any(kw in message_lower for kw in research_keywords):
            # Try to extract school name
            schools = ["mit", "stanford", "berkeley", "cmu", "carnegie mellon", "georgia tech"]
            school = next((s for s in schools if s in message_lower), None)
            
            return {
                "use_tool": True,
                "tool_name": "program_research",
                "tool_params": {
                    "school": school or "unknown",
                    "program": "Computer Science",
                    "info_type": "all"
                },
                "reasoning": "User wants program information"
            }
        
        # Check for essay analysis
        essay_keywords = ["essay", "sop", "statement of purpose", "analyze", "review my"]
        if any(kw in message_lower for kw in essay_keywords):
            return {
                "use_tool": True,
                "tool_name": "essay_analyzer",
                "tool_params": {
                    "essay_text": user_message,
                    "analysis_type": "full"
                },
                "reasoning": "User wants essay feedback"
            }
        
        # Check for task/calendar keywords
        task_keywords = ["task", "to-do", "todo", "deadline", "due", "remind", "upcoming"]
        if any(kw in message_lower for kw in task_keywords):
            action = "list_tasks"
            if any(w in message_lower for w in ["upcoming", "due soon", "this week"]):
                action = "upcoming"
            elif any(w in message_lower for w in ["create", "add", "new task"]):
                action = "create_task"
            elif any(w in message_lower for w in ["complete", "done", "finish"]):
                action = "complete_task"
            
            return {
                "use_tool": True,
                "tool_name": "calendar_todo",
                "tool_params": {"action": action},
                "reasoning": "User wants to manage tasks"
            }
        
        # No tool needed
        return {
            "use_tool": False,
            "tool_name": None,
            "tool_params": {},
            "reasoning": "General conversation - no tool needed"
        }
    
    def _execute_tool(self, tool_name: str, params: Dict) -> Dict[str, Any]:
        """
        Execute the specified tool with given parameters.
        
        Args:
            tool_name: Name of the tool to execute
            params: Parameters to pass to the tool
            
        Returns:
            Tool execution result
        """
        tool = self.tools.get(tool_name)
        if not tool:
            return {"success": False, "error": f"Unknown tool: {tool_name}"}
        
        try:
            result = tool.execute(**params)
            return result
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _generate_response(
        self,
        user_message: str,
        memory_context: str,
        app_summary: str,
        tool_results: List[Dict]
    ) -> str:
        """
        Generate the final response to the user.
        
        Uses the LLM to create a natural, helpful response based on:
        - The user's message
        - Retrieved memory context
        - Tool execution results
        """
        # Build tool descriptions
        tool_desc = "\n".join([
            f"- {td['name']}: {td['description'][:100]}..."
            for td in self.tool_definitions
        ])
        
        # Build user context
        user_context = f"{memory_context}\n\nCurrent State:\n{app_summary}"
        
        # Build system prompt
        system_prompt = self.SYSTEM_PROMPT.format(
            tool_descriptions=tool_desc,
            user_context=user_context[:2000],  # Truncate if too long
            current_date=datetime.now().strftime("%B %d, %Y")
        )
        
        # Build the message with tool results
        if tool_results:
            tool_context = "\n\nTool Results:\n"
            for tr in tool_results:
                tool_context += f"Tool: {tr['tool']}\n"
                tool_context += f"Result: {json.dumps(tr['result'], indent=2)[:1000]}\n"
            
            user_content = f"{user_message}\n{tool_context}\n\nBased on the tool results above, provide a helpful response to the user."
        else:
            user_content = user_message
        
        if self.client:
            try:
                response = self.client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content}
                    ],
                    temperature=0.7,
                    max_tokens=1000
                )
                
                return response.choices[0].message.content.strip()
                
            except Exception as e:
                self._trace("ERROR", f"LLM response generation failed: {e}")
                return self._generate_fallback_response(user_message, tool_results)
        else:
            return self._generate_fallback_response(user_message, tool_results)
    
    def _generate_fallback_response(
        self,
        user_message: str,
        tool_results: List[Dict]
    ) -> str:
        """
        Generate a response when LLM is unavailable.
        Uses tool results directly to form a response.
        """
        if not tool_results:
            return "I understand you said: '{}'. How can I help you with your graduate school applications today?".format(
                user_message[:100]
            )
        
        # Format tool results as response
        responses = []
        for tr in tool_results:
            result = tr["result"]
            if result.get("success"):
                msg = result.get("message", "")
                data = result.get("data", {})
                
                if msg:
                    responses.append(msg)
                
                # Add relevant data points
                if isinstance(data, dict):
                    if data.get("applications"):
                        apps = data["applications"]
                        responses.append(f"You have {len(apps)} applications.")
                    if data.get("deadline"):
                        responses.append(f"Deadline: {data['deadline']}")
                    if data.get("overall_score"):
                        responses.append(f"Essay score: {data['overall_score']}/100")
            else:
                responses.append(f"I encountered an issue: {result.get('error', 'Unknown error')}")
        
        return " ".join(responses) if responses else "I've processed your request. Is there anything else you'd like to know?"
    
    def _trace(self, step: str, message: str):
        """Add a step to the reasoning trace"""
        trace_entry = {
            "step": step,
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
        self.last_reasoning_trace.append(trace_entry)
        print(f"[{step}] {message}")  # Also log to console for debugging
    
    def get_reasoning_trace(self) -> List[Dict]:
        """Get the reasoning trace from the last interaction"""
        return self.last_reasoning_trace


# ============================================
# Helper Functions
# ============================================

def create_agent(db_manager, memory_manager) -> GradTrackAgent:
    """Factory function to create the agent"""
    return GradTrackAgent(db_manager, memory_manager)
