"""
MCP Tool: Essay Analyzer
Analyzes Statements of Purpose and other application essays.
"""

from typing import Dict, Any, List, Optional
import re
from collections import Counter


class EssayAnalyzerTool:
    """
    MCP Tool for analyzing graduate school application essays.
    Provides feedback on structure, content, and suggestions for improvement.
    """

    name = "essay_analyzer"
    description = "Analyze Statement of Purpose and application essays - get feedback on structure, clarity, and content"

    def __init__(self):
        # Keywords that are often valuable in SOPs
        self.positive_keywords = [
            "research", "experience", "project", "published", "led", "developed",
            "implemented", "designed", "analyzed", "collaborated", "mentored",
            "presented", "conference", "journal", "thesis", "dissertation",
            "laboratory", "methodology", "hypothesis", "findings", "results",
            "impact", "contribution", "innovation", "novel", "unique"
        ]

        # Common SOP sections
        self.expected_sections = [
            "introduction",
            "background",
            "research interests",
            "relevant experience",
            "why this program",
            "career goals",
            "conclusion"
        ]

        # Common weak phrases to avoid
        self.weak_phrases = [
            "ever since I was a child",
            "I have always wanted",
            "I am passionate about",
            "I believe",
            "I feel that",
            "I think that",
            "very unique",
            "really interesting",
            "a lot of experience"
        ]

    def get_schema(self) -> Dict[str, Any]:
        """Return the JSON schema for this tool."""
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": {
                "type": "object",
                "properties": {
                    "essay_content": {
                        "type": "string",
                        "description": "The full text of the essay to analyze"
                    },
                    "essay_type": {
                        "type": "string",
                        "enum": ["sop", "personal_statement", "diversity", "research_statement"],
                        "description": "Type of essay being analyzed"
                    },
                    "school_name": {
                        "type": "string",
                        "description": "Target school (for context-specific feedback)"
                    },
                    "program_name": {
                        "type": "string",
                        "description": "Target program (for context-specific feedback)"
                    },
                    "word_limit": {
                        "type": "integer",
                        "description": "Word limit for the essay (if any)"
                    }
                },
                "required": ["essay_content"]
            }
        }

    def execute(self, **kwargs) -> Dict[str, Any]:
        """Execute the essay analysis."""
        essay = kwargs.get("essay_content", "")
        essay_type = kwargs.get("essay_type", "sop")
        school_name = kwargs.get("school_name")
        program_name = kwargs.get("program_name")
        word_limit = kwargs.get("word_limit")

        if not essay or len(essay.strip()) < 100:
            return {"error": "Essay content is too short for meaningful analysis"}

        # Perform analysis
        basic_stats = self._get_basic_stats(essay)
        structure_analysis = self._analyze_structure(essay)
        content_analysis = self._analyze_content(essay)
        style_analysis = self._analyze_style(essay)
        keyword_analysis = self._analyze_keywords(essay)

        # Check word limit if provided
        word_limit_status = None
        if word_limit:
            word_count = basic_stats["word_count"]
            if word_count > word_limit:
                word_limit_status = f"OVER LIMIT: {word_count}/{word_limit} words (reduce by {word_count - word_limit})"
            elif word_count < word_limit * 0.8:
                word_limit_status = f"Under target: {word_count}/{word_limit} words (consider adding {int(word_limit * 0.9 - word_count)} more)"
            else:
                word_limit_status = f"Good length: {word_count}/{word_limit} words"

        # Generate specific suggestions
        suggestions = self._generate_suggestions(
            structure_analysis,
            content_analysis,
            style_analysis,
            school_name,
            program_name
        )

        # Calculate overall score
        score = self._calculate_score(
            structure_analysis,
            content_analysis,
            style_analysis,
            keyword_analysis
        )

        return {
            "basic_stats": basic_stats,
            "structure": structure_analysis,
            "content": content_analysis,
            "style": style_analysis,
            "keywords": keyword_analysis,
            "word_limit_status": word_limit_status,
            "suggestions": suggestions,
            "overall_score": score,
            "summary": self._generate_summary(score, suggestions)
        }

    def _get_basic_stats(self, essay: str) -> Dict[str, Any]:
        """Get basic statistics about the essay."""
        words = essay.split()
        sentences = re.split(r'[.!?]+', essay)
        sentences = [s.strip() for s in sentences if s.strip()]
        paragraphs = [p.strip() for p in essay.split('\n\n') if p.strip()]

        avg_sentence_length = len(words) / len(sentences) if sentences else 0
        avg_paragraph_length = len(words) / len(paragraphs) if paragraphs else 0

        return {
            "word_count": len(words),
            "character_count": len(essay),
            "sentence_count": len(sentences),
            "paragraph_count": len(paragraphs),
            "avg_sentence_length": round(avg_sentence_length, 1),
            "avg_paragraph_length": round(avg_paragraph_length, 1)
        }

    def _analyze_structure(self, essay: str) -> Dict[str, Any]:
        """Analyze the essay's structure."""
        paragraphs = [p.strip() for p in essay.split('\n\n') if p.strip()]

        # Check for introduction and conclusion
        has_strong_intro = len(paragraphs) > 0 and len(paragraphs[0].split()) >= 50
        has_conclusion = len(paragraphs) > 0 and any(
            word in paragraphs[-1].lower()
            for word in ["ultimately", "in conclusion", "finally", "looking forward", "future", "goal"]
        )

        # Check paragraph balance
        paragraph_lengths = [len(p.split()) for p in paragraphs]
        length_variance = max(paragraph_lengths) - min(paragraph_lengths) if paragraph_lengths else 0
        well_balanced = length_variance < 100

        return {
            "has_strong_intro": has_strong_intro,
            "has_conclusion": has_conclusion,
            "paragraph_count": len(paragraphs),
            "paragraph_lengths": paragraph_lengths,
            "well_balanced": well_balanced,
            "structure_score": self._calculate_structure_score(
                has_strong_intro, has_conclusion, len(paragraphs), well_balanced
            )
        }

    def _calculate_structure_score(self, has_intro: bool, has_conclusion: bool,
                                   para_count: int, balanced: bool) -> int:
        """Calculate structure score out of 25."""
        score = 0
        if has_intro:
            score += 7
        if has_conclusion:
            score += 7
        if 4 <= para_count <= 8:
            score += 6
        elif para_count > 2:
            score += 3
        if balanced:
            score += 5
        return score

    def _analyze_content(self, essay: str) -> Dict[str, Any]:
        """Analyze the essay's content."""
        essay_lower = essay.lower()

        # Check for specific elements
        mentions_research = any(word in essay_lower for word in ["research", "project", "study", "investigate"])
        mentions_faculty = any(word in essay_lower for word in ["professor", "faculty", "lab", "advisor", "dr."])
        mentions_program_fit = any(phrase in essay_lower for phrase in ["this program", "your department", "at stanford", "at mit"])
        mentions_goals = any(word in essay_lower for word in ["goal", "aspire", "future", "career", "aim"])
        has_specific_examples = bool(re.search(r'\d{4}|published|presented|developed|built|created', essay_lower))

        return {
            "mentions_research": mentions_research,
            "mentions_faculty": mentions_faculty,
            "mentions_program_fit": mentions_program_fit,
            "mentions_goals": mentions_goals,
            "has_specific_examples": has_specific_examples,
            "content_score": self._calculate_content_score(
                mentions_research, mentions_faculty, mentions_program_fit,
                mentions_goals, has_specific_examples
            )
        }

    def _calculate_content_score(self, research: bool, faculty: bool,
                                 fit: bool, goals: bool, examples: bool) -> int:
        """Calculate content score out of 25."""
        score = 0
        if research:
            score += 5
        if faculty:
            score += 5
        if fit:
            score += 5
        if goals:
            score += 5
        if examples:
            score += 5
        return score

    def _analyze_style(self, essay: str) -> Dict[str, Any]:
        """Analyze the essay's writing style."""
        essay_lower = essay.lower()

        # Count weak phrases
        weak_phrase_count = sum(
            1 for phrase in self.weak_phrases
            if phrase in essay_lower
        )

        # Check for passive voice indicators
        passive_indicators = len(re.findall(r'\b(was|were|been|being|is|are)\s+\w+ed\b', essay_lower))

        # Check for first person overuse
        first_person_count = len(re.findall(r'\bI\b', essay))
        words = essay.split()
        first_person_ratio = first_person_count / len(words) if words else 0

        # Check sentence variety
        sentences = re.split(r'[.!?]+', essay)
        sentence_starts = [s.strip().split()[0].lower() if s.strip().split() else "" for s in sentences]
        start_variety = len(set(sentence_starts)) / len(sentence_starts) if sentence_starts else 0

        return {
            "weak_phrase_count": weak_phrase_count,
            "weak_phrases_found": [p for p in self.weak_phrases if p in essay_lower],
            "passive_voice_count": passive_indicators,
            "first_person_ratio": round(first_person_ratio, 3),
            "sentence_variety": round(start_variety, 2),
            "style_score": self._calculate_style_score(
                weak_phrase_count, passive_indicators, first_person_ratio, start_variety
            )
        }

    def _calculate_style_score(self, weak_phrases: int, passive: int,
                               first_person: float, variety: float) -> int:
        """Calculate style score out of 25."""
        score = 25
        score -= min(weak_phrases * 2, 8)
        score -= min(passive, 5)
        if first_person > 0.04:  # More than 4% is too much "I"
            score -= 4
        if variety < 0.5:
            score -= 4
        return max(score, 0)

    def _analyze_keywords(self, essay: str) -> Dict[str, Any]:
        """Analyze keyword usage."""
        essay_lower = essay.lower()
        words = re.findall(r'\b\w+\b', essay_lower)

        # Count positive keywords
        keyword_counts = {}
        for keyword in self.positive_keywords:
            count = essay_lower.count(keyword)
            if count > 0:
                keyword_counts[keyword] = count

        # Most common words (excluding stopwords)
        stopwords = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
                    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
                    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
                    'could', 'should', 'may', 'might', 'must', 'that', 'this', 'these',
                    'those', 'i', 'my', 'me', 'we', 'our', 'you', 'your', 'it', 'its'}
        content_words = [w for w in words if w not in stopwords and len(w) > 3]
        word_freq = Counter(content_words).most_common(10)

        return {
            "positive_keywords_found": keyword_counts,
            "positive_keyword_count": sum(keyword_counts.values()),
            "most_common_words": dict(word_freq),
            "keyword_score": min(sum(keyword_counts.values()) * 2, 25)
        }

    def _generate_suggestions(self, structure: Dict, content: Dict,
                             style: Dict, school: str, program: str) -> List[str]:
        """Generate specific improvement suggestions."""
        suggestions = []

        # Structure suggestions
        if not structure["has_strong_intro"]:
            suggestions.append("Strengthen your introduction - start with a compelling hook that showcases your unique perspective or experience")

        if not structure["has_conclusion"]:
            suggestions.append("Add a strong conclusion that ties back to your goals and why this program is the right fit")

        if structure["paragraph_count"] < 4:
            suggestions.append("Consider adding more paragraphs to better organize your ideas")

        # Content suggestions
        if not content["mentions_faculty"]:
            suggestions.append(f"Mention specific faculty members {'at ' + school if school else ''} whose research aligns with your interests")

        if not content["mentions_program_fit"]:
            suggestions.append(f"Explain specifically why {'this program' if not program else program} is the right fit for your goals")

        if not content["has_specific_examples"]:
            suggestions.append("Include more specific examples with concrete details (dates, outcomes, impact)")

        if not content["mentions_research"]:
            suggestions.append("Discuss your research experience and interests in more detail")

        # Style suggestions
        if style["weak_phrases_found"]:
            suggestions.append(f"Replace weak phrases like '{style['weak_phrases_found'][0]}' with stronger, more specific language")

        if style["passive_voice_count"] > 5:
            suggestions.append("Reduce passive voice - use active verbs to make your writing more dynamic")

        if style["first_person_ratio"] > 0.04:
            suggestions.append("Vary your sentence structure - not every sentence needs to start with 'I'")

        return suggestions[:6]  # Return top 6 suggestions

    def _calculate_score(self, structure: Dict, content: Dict,
                        style: Dict, keywords: Dict) -> Dict[str, Any]:
        """Calculate overall score."""
        structure_score = structure.get("structure_score", 0)
        content_score = content.get("content_score", 0)
        style_score = style.get("style_score", 0)
        keyword_score = keywords.get("keyword_score", 0)

        total = structure_score + content_score + style_score + keyword_score

        return {
            "total": total,
            "max_score": 100,
            "breakdown": {
                "structure": f"{structure_score}/25",
                "content": f"{content_score}/25",
                "style": f"{style_score}/25",
                "keywords": f"{keyword_score}/25"
            },
            "grade": self._score_to_grade(total)
        }

    def _score_to_grade(self, score: int) -> str:
        """Convert score to letter grade."""
        if score >= 90:
            return "A"
        elif score >= 80:
            return "B+"
        elif score >= 70:
            return "B"
        elif score >= 60:
            return "C+"
        elif score >= 50:
            return "C"
        else:
            return "Needs Work"

    def _generate_summary(self, score: Dict, suggestions: List[str]) -> str:
        """Generate a human-readable summary."""
        grade = score.get("grade", "N/A")
        total = score.get("total", 0)

        if total >= 80:
            intro = "Your essay is strong and well-written."
        elif total >= 60:
            intro = "Your essay has a solid foundation with room for improvement."
        else:
            intro = "Your essay needs significant revision before submission."

        top_suggestions = " ".join(f"{i+1}) {s}" for i, s in enumerate(suggestions[:3]))

        return f"{intro} Overall score: {total}/100 ({grade}). Key improvements: {top_suggestions}"


# Create singleton instance
essay_analyzer_tool = EssayAnalyzerTool()
