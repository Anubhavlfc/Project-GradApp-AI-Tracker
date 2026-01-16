"""
GradTrack AI - Essay Analyzer MCP Tool

This MCP tool analyzes Statement of Purpose (SOP) essays and provides:
- Structural feedback
- Keyword analysis
- Length assessment
- Clarity scoring
- Improvement suggestions

The tool uses rule-based analysis enhanced with pattern matching.
In production, this could integrate with a language model for deeper analysis.

Tool Schema:
{
    "name": "essay_analyzer",
    "description": "Analyze Statement of Purpose essays",
    "parameters": {
        "essay_text": "The full text of the essay",
        "target_school": "Optional: school name for keyword targeting",
        "target_program": "Optional: program for relevant keywords"
    }
}
"""

from typing import Dict, Any, Optional, List
import re
from collections import Counter


class EssayAnalyzerTool:
    """
    MCP Tool for analyzing Statement of Purpose essays.
    
    This tool is invoked by the agent when a user:
    - Pastes their SOP and asks for feedback
    - Wants to know if their essay is the right length
    - Needs keyword suggestions for a specific program
    
    The analysis is rule-based but provides actionable feedback.
    """
    
    TOOL_NAME = "essay_analyzer"
    TOOL_DESCRIPTION = """
    Analyze a Statement of Purpose (SOP) essay and provide feedback.
    Use this tool when the user shares their essay and wants:
    - Structural feedback (intro, body, conclusion)
    - Word count and length assessment
    - Keyword analysis and suggestions
    - Clarity and readability scoring
    - Specific improvement suggestions
    
    Returns detailed analysis with actionable recommendations.
    """
    
    TOOL_SCHEMA = {
        "name": "essay_analyzer",
        "description": TOOL_DESCRIPTION,
        "parameters": {
            "type": "object",
            "properties": {
                "essay_text": {
                    "type": "string",
                    "description": "The full text of the Statement of Purpose"
                },
                "target_school": {
                    "type": "string",
                    "description": "Target school name for tailored feedback"
                },
                "target_program": {
                    "type": "string", 
                    "description": "Target program (e.g., 'Computer Science PhD')"
                },
                "analysis_type": {
                    "type": "string",
                    "enum": ["full", "structure", "keywords", "length", "clarity"],
                    "description": "Type of analysis to perform",
                    "default": "full"
                }
            },
            "required": ["essay_text"]
        }
    }
    
    # Ideal word counts by degree type
    IDEAL_LENGTHS = {
        "PhD": {"min": 800, "max": 1200, "ideal": 1000},
        "MS": {"min": 500, "max": 1000, "ideal": 750},
        "default": {"min": 500, "max": 1000, "ideal": 800}
    }
    
    # Keywords that should typically appear in CS SOPs
    CS_KEYWORDS = {
        "research": ["research", "investigate", "study", "explore", "analyze"],
        "technical": ["machine learning", "artificial intelligence", "algorithms", 
                     "systems", "data", "programming", "software", "neural networks",
                     "deep learning", "computer vision", "NLP", "natural language"],
        "motivation": ["passion", "driven", "motivated", "inspired", "curious",
                      "dedicated", "committed", "interested"],
        "experience": ["project", "internship", "publication", "thesis", "developed",
                      "implemented", "designed", "built", "created", "led"],
        "goals": ["goal", "aim", "aspire", "plan", "future", "career", "contribute"],
        "fit": ["professor", "faculty", "lab", "group", "department", "program",
               "university", "fit", "align", "match"]
    }
    
    # Red flag phrases to avoid
    RED_FLAGS = [
        "since I was a child",
        "ever since I was young",
        "from a young age",
        "I have always wanted",
        "my dream has always been",
        "I am a hard worker",
        "I am a quick learner",
        "I am a team player",
        "Webster's dictionary defines",
        "In this essay, I will"
    ]
    
    # Strong action verbs
    STRONG_VERBS = [
        "developed", "implemented", "designed", "created", "led", "managed",
        "analyzed", "evaluated", "improved", "optimized", "built", "architected",
        "discovered", "pioneered", "established", "transformed", "increased",
        "reduced", "achieved", "published", "presented", "collaborated"
    ]
    
    def __init__(self):
        pass
    
    def execute(self, **params) -> Dict[str, Any]:
        """
        Execute the essay analysis with given parameters.
        
        Returns comprehensive feedback on the essay.
        """
        essay_text = params.get("essay_text", "").strip()
        target_school = params.get("target_school")
        target_program = params.get("target_program")
        analysis_type = params.get("analysis_type", "full")
        
        if not essay_text:
            return self._error("Missing required parameter: essay_text")
        
        if len(essay_text) < 100:
            return self._error("Essay text is too short to analyze. Please provide the full essay.")
        
        # Perform analysis based on type
        if analysis_type == "full":
            result = self._full_analysis(essay_text, target_school, target_program)
        elif analysis_type == "structure":
            result = self._analyze_structure(essay_text)
        elif analysis_type == "keywords":
            result = self._analyze_keywords(essay_text, target_program)
        elif analysis_type == "length":
            result = self._analyze_length(essay_text)
        elif analysis_type == "clarity":
            result = self._analyze_clarity(essay_text)
        else:
            return self._error(f"Unknown analysis_type: {analysis_type}")
        
        return self._success(data=result)
    
    def _full_analysis(self, essay: str, school: Optional[str], program: Optional[str]) -> Dict:
        """Perform comprehensive essay analysis"""
        structure = self._analyze_structure(essay)
        keywords = self._analyze_keywords(essay, program)
        length = self._analyze_length(essay)
        clarity = self._analyze_clarity(essay)
        red_flags = self._check_red_flags(essay)
        strong_points = self._identify_strong_points(essay)
        suggestions = self._generate_suggestions(
            structure, keywords, length, clarity, red_flags, school, program
        )
        
        # Calculate overall score (0-100)
        overall_score = self._calculate_overall_score(
            structure, keywords, length, clarity, red_flags
        )
        
        return {
            "overall_score": overall_score,
            "word_count": length["word_count"],
            "structure": structure,
            "keywords": keywords,
            "length_analysis": length,
            "clarity": clarity,
            "red_flags": red_flags,
            "strong_points": strong_points,
            "suggestions": suggestions,
            "target_school": school,
            "target_program": program
        }
    
    def _analyze_structure(self, essay: str) -> Dict:
        """Analyze essay structure"""
        paragraphs = [p.strip() for p in essay.split('\n\n') if p.strip()]
        sentences = re.split(r'[.!?]+', essay)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        # Check for key structural elements
        has_clear_intro = len(paragraphs) > 0 and len(paragraphs[0].split()) >= 50
        has_clear_conclusion = len(paragraphs) > 2 and len(paragraphs[-1].split()) >= 40
        
        # Check paragraph balance
        para_lengths = [len(p.split()) for p in paragraphs]
        avg_para_length = sum(para_lengths) / len(para_lengths) if para_lengths else 0
        
        # Look for transitional phrases
        transitions = [
            "furthermore", "moreover", "additionally", "however", "nevertheless",
            "in addition", "consequently", "therefore", "as a result", "specifically",
            "for example", "for instance", "in particular"
        ]
        transition_count = sum(1 for t in transitions if t.lower() in essay.lower())
        
        structure_score = 0
        feedback = []
        
        if has_clear_intro:
            structure_score += 25
            feedback.append("✅ Strong opening paragraph")
        else:
            feedback.append("⚠️ Consider strengthening your introduction")
        
        if has_clear_conclusion:
            structure_score += 25
            feedback.append("✅ Clear conclusion")
        else:
            feedback.append("⚠️ Consider adding a stronger conclusion")
        
        if 3 <= len(paragraphs) <= 7:
            structure_score += 25
            feedback.append(f"✅ Good paragraph count ({len(paragraphs)} paragraphs)")
        else:
            feedback.append(f"⚠️ Consider restructuring ({len(paragraphs)} paragraphs - aim for 4-6)")
        
        if transition_count >= 3:
            structure_score += 25
            feedback.append(f"✅ Good use of transitions ({transition_count} found)")
        else:
            feedback.append("⚠️ Consider adding more transitional phrases")
        
        return {
            "score": structure_score,
            "paragraph_count": len(paragraphs),
            "sentence_count": len(sentences),
            "avg_paragraph_length": round(avg_para_length),
            "has_clear_intro": has_clear_intro,
            "has_clear_conclusion": has_clear_conclusion,
            "transition_count": transition_count,
            "feedback": feedback
        }
    
    def _analyze_keywords(self, essay: str, program: Optional[str]) -> Dict:
        """Analyze keyword usage"""
        essay_lower = essay.lower()
        
        # Count keyword categories
        category_scores = {}
        found_keywords = {}
        missing_categories = []
        
        for category, keywords in self.CS_KEYWORDS.items():
            found = [kw for kw in keywords if kw.lower() in essay_lower]
            category_scores[category] = len(found)
            found_keywords[category] = found
            
            if len(found) == 0:
                missing_categories.append(category)
        
        # Calculate keyword score
        total_categories = len(self.CS_KEYWORDS)
        categories_with_keywords = sum(1 for v in category_scores.values() if v > 0)
        keyword_score = int((categories_with_keywords / total_categories) * 100)
        
        feedback = []
        if categories_with_keywords >= 5:
            feedback.append("✅ Excellent keyword coverage across categories")
        elif categories_with_keywords >= 3:
            feedback.append("✅ Good keyword coverage")
        else:
            feedback.append("⚠️ Consider adding more relevant keywords")
        
        if missing_categories:
            feedback.append(f"⚠️ Missing keywords in: {', '.join(missing_categories)}")
        
        return {
            "score": keyword_score,
            "category_scores": category_scores,
            "found_keywords": found_keywords,
            "missing_categories": missing_categories,
            "feedback": feedback
        }
    
    def _analyze_length(self, essay: str) -> Dict:
        """Analyze essay length"""
        words = essay.split()
        word_count = len(words)
        char_count = len(essay)
        
        ideal = self.IDEAL_LENGTHS["default"]
        
        if word_count < ideal["min"]:
            length_status = "too_short"
            feedback = f"⚠️ Essay is short ({word_count} words). Aim for {ideal['min']}-{ideal['max']} words."
            score = int((word_count / ideal["min"]) * 70)
        elif word_count > ideal["max"]:
            length_status = "too_long"
            feedback = f"⚠️ Essay is long ({word_count} words). Consider trimming to {ideal['max']} words."
            score = max(50, 100 - int(((word_count - ideal["max"]) / ideal["max"]) * 50))
        else:
            length_status = "good"
            feedback = f"✅ Good length ({word_count} words)"
            score = 100
        
        return {
            "score": min(100, score),
            "word_count": word_count,
            "character_count": char_count,
            "status": length_status,
            "ideal_range": f"{ideal['min']}-{ideal['max']} words",
            "feedback": [feedback]
        }
    
    def _analyze_clarity(self, essay: str) -> Dict:
        """Analyze writing clarity"""
        sentences = re.split(r'[.!?]+', essay)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        # Calculate average sentence length
        sentence_lengths = [len(s.split()) for s in sentences]
        avg_sentence_length = sum(sentence_lengths) / len(sentence_lengths) if sentence_lengths else 0
        
        # Count very long sentences (30+ words)
        long_sentences = sum(1 for l in sentence_lengths if l > 30)
        
        # Count passive voice indicators
        passive_indicators = ["was", "were", "been", "being", "is being", "are being",
                             "has been", "have been", "had been"]
        passive_count = sum(essay.lower().count(p) for p in passive_indicators)
        
        # Count first-person pronouns (should be used, but not excessively)
        first_person = essay.lower().count(" i ") + essay.lower().count("my ")
        
        clarity_score = 100
        feedback = []
        
        # Sentence length assessment
        if avg_sentence_length < 25:
            feedback.append(f"✅ Good sentence length (avg {avg_sentence_length:.1f} words)")
        else:
            clarity_score -= 15
            feedback.append(f"⚠️ Some sentences are long (avg {avg_sentence_length:.1f} words)")
        
        # Long sentence count
        if long_sentences > 3:
            clarity_score -= 10
            feedback.append(f"⚠️ {long_sentences} sentences exceed 30 words")
        
        # Passive voice
        passive_ratio = passive_count / len(sentences) if sentences else 0
        if passive_ratio > 0.3:
            clarity_score -= 10
            feedback.append("⚠️ Consider using more active voice")
        else:
            feedback.append("✅ Good use of active voice")
        
        return {
            "score": max(0, clarity_score),
            "avg_sentence_length": round(avg_sentence_length, 1),
            "long_sentences": long_sentences,
            "passive_voice_indicators": passive_count,
            "first_person_count": first_person,
            "feedback": feedback
        }
    
    def _check_red_flags(self, essay: str) -> Dict:
        """Check for cliché phrases to avoid"""
        essay_lower = essay.lower()
        found_flags = []
        
        for phrase in self.RED_FLAGS:
            if phrase.lower() in essay_lower:
                found_flags.append(phrase)
        
        score = max(0, 100 - (len(found_flags) * 15))
        
        feedback = []
        if found_flags:
            feedback.append("⚠️ Found cliché phrases to reconsider:")
            for flag in found_flags:
                feedback.append(f"  - '{flag}'")
        else:
            feedback.append("✅ No common clichés detected")
        
        return {
            "score": score,
            "found": found_flags,
            "count": len(found_flags),
            "feedback": feedback
        }
    
    def _identify_strong_points(self, essay: str) -> List[str]:
        """Identify strong points in the essay"""
        strong_points = []
        essay_lower = essay.lower()
        
        # Check for strong verbs
        verb_count = sum(1 for v in self.STRONG_VERBS if v in essay_lower)
        if verb_count >= 5:
            strong_points.append(f"Good use of action verbs ({verb_count} found)")
        
        # Check for specific details (numbers, percentages)
        numbers = re.findall(r'\d+', essay)
        if len(numbers) >= 3:
            strong_points.append("Includes specific quantitative details")
        
        # Check for faculty mentions
        if "professor" in essay_lower or "dr." in essay_lower or "faculty" in essay_lower:
            strong_points.append("Mentions specific faculty or professors")
        
        # Check for research mentions
        if "research" in essay_lower and ("project" in essay_lower or "paper" in essay_lower):
            strong_points.append("Discusses research experience")
        
        # Check for future goals
        if "goal" in essay_lower or "aim" in essay_lower or "future" in essay_lower:
            strong_points.append("Articulates future goals")
        
        return strong_points
    
    def _generate_suggestions(
        self, structure: Dict, keywords: Dict, length: Dict,
        clarity: Dict, red_flags: Dict, school: Optional[str], program: Optional[str]
    ) -> List[str]:
        """Generate specific improvement suggestions"""
        suggestions = []
        
        # Structure suggestions
        if structure["score"] < 75:
            suggestions.append("Strengthen your essay structure with a clear introduction, body paragraphs, and conclusion")
        
        # Keyword suggestions
        if keywords["missing_categories"]:
            for cat in keywords["missing_categories"][:2]:
                suggestions.append(f"Add content related to {cat}")
        
        # Length suggestions
        if length["status"] == "too_short":
            suggestions.append("Expand on your experiences and motivations with specific examples")
        elif length["status"] == "too_long":
            suggestions.append("Remove redundant phrases and focus on your strongest points")
        
        # Clarity suggestions
        if clarity["score"] < 80:
            suggestions.append("Shorten long sentences for better readability")
        
        # Red flag suggestions
        if red_flags["count"] > 0:
            suggestions.append("Replace cliché phrases with specific, personal statements")
        
        # School-specific suggestions
        if school:
            suggestions.append(f"Mention why {school} specifically fits your goals")
        
        # Program-specific suggestions
        if program:
            suggestions.append(f"Reference specific aspects of the {program} program")
        
        return suggestions[:5]  # Return top 5 suggestions
    
    def _calculate_overall_score(
        self, structure: Dict, keywords: Dict, length: Dict,
        clarity: Dict, red_flags: Dict
    ) -> int:
        """Calculate weighted overall score"""
        weights = {
            "structure": 0.25,
            "keywords": 0.20,
            "length": 0.15,
            "clarity": 0.25,
            "red_flags": 0.15
        }
        
        score = (
            structure["score"] * weights["structure"] +
            keywords["score"] * weights["keywords"] +
            length["score"] * weights["length"] +
            clarity["score"] * weights["clarity"] +
            red_flags["score"] * weights["red_flags"]
        )
        
        return int(score)
    
    def _success(self, message: str = None, data: Any = None) -> Dict[str, Any]:
        """Create a success response"""
        response = {"success": True}
        if message:
            response["message"] = message
        if data is not None:
            response["data"] = data
        return response
    
    def _error(self, message: str) -> Dict[str, Any]:
        """Create an error response"""
        return {"success": False, "error": message}


# ============================================
# Tool Registration for Agent
# ============================================

def get_tool_definition() -> Dict:
    """Return the tool definition for the agent"""
    return EssayAnalyzerTool.TOOL_SCHEMA


def create_tool() -> EssayAnalyzerTool:
    """Factory function to create the tool"""
    return EssayAnalyzerTool()
