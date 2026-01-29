import { useState, useRef } from 'react';
import { Search, Sparkles, TrendingUp, BookOpen, MapPin, DollarSign, Calendar, Award } from 'lucide-react';

/**
 * Research Panel Component
 *
 * AI-powered program discovery and research tool
 */
function ResearchPanel({ onAddApplication }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [activeTab, setActiveTab] = useState('search'); // search | recommendations
  const inputRef = useRef(null);

  // Search for programs using web search API
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    setActiveTab('search');

    try {
      // Call web search API
      const response = await fetch(`http://localhost:8000/api/search/programs?query=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();

      if (data.success) {
        setResults({
          query: searchQuery,
          programs: data.programs.map(p => ({
            school: p.school,
            program: p.program,
            degrees: [p.degree],
            location: p.location,
            deadline: p.deadline,
            ranking: p.ranking,
            acceptance_rate: p.acceptance_rate,
            funding: p.funding,
            gre_required: p.gre_required,
            toefl_min: p.toefl_min,
            highlights: p.highlights,
            relevance_score: p.relevance_score
          }))
        });
      } else {
        setResults({
          query: searchQuery,
          programs: []
        });
      }
      setSearching(false);
    } catch (error) {
      console.error('Search failed:', error);
      setResults({
        query: searchQuery,
        programs: []
      });
      setSearching(false);
    }
  };

  // Get AI recommendations
  const handleGetRecommendations = async () => {
    setActiveTab('recommendations');
    setSearching(true);

    try {
      const response = await fetch(`http://localhost:8000/api/search/recommendations?num_recommendations=5`);
      const data = await response.json();

      if (data.success) {
        setRecommendations(data.recommendations.map(rec => ({
          school: rec.school,
          program: rec.program,
          tier: rec.tier,
          reasoning: rec.reasoning,
          highlights: rec.highlights,
          ranking: rec.ranking,
          location: rec.location,
          deadline: rec.deadline,
          acceptance_rate: rec.acceptance_rate,
          funding: rec.funding
        })));
      } else {
        setRecommendations([]);
      }
      setSearching(false);
    } catch (error) {
      console.error('Recommendations failed:', error);
      setRecommendations([]);
      setSearching(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-1.5 rounded-lg">
            <Search size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Program Discovery</h3>
            <p className="text-xs text-gray-500">AI-powered research tool</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'search'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-gray-600 hover:bg-white/50'
            }`}
          >
            <Search size={12} className="inline mr-1" />
            Search
          </button>
          <button
            onClick={handleGetRecommendations}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'recommendations'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-gray-600 hover:bg-white/50'
            }`}
          >
            <Sparkles size={12} className="inline mr-1" />
            Recommended
          </button>
        </div>
      </div>

      {/* Search Tab */}
      {activeTab === 'search' && (
        <>
          {/* Search Input */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Search universities or programs..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
              <button
                onClick={handleSearch}
                disabled={!searchQuery.trim() || searching}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 text-sm font-medium"
              >
                <Search size={16} />
              </button>
            </div>

            {/* Quick Suggestions */}
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs text-gray-500">Try:</span>
              {['MIT', 'Stanford', 'Computer Science', 'Machine Learning'].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setSearchQuery(suggestion);
                    inputRef.current?.focus();
                  }}
                  className="text-xs px-2 py-1 bg-white border border-gray-200 rounded-md hover:bg-purple-50 hover:border-purple-300 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Search Results */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {searching && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Searching programs...</p>
                </div>
              </div>
            )}

            {results && !searching && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-3">
                  Found {results.programs.length} programs for "{results.query}"
                </p>

                {results.programs.map((program, idx) => (
                  <ProgramCard key={idx} program={program} onAdd={onAddApplication} />
                ))}

                {results.programs.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <BookOpen size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No programs found</p>
                    <p className="text-xs mt-1">Try searching for MIT, Stanford, or CMU</p>
                  </div>
                )}
              </div>
            )}

            {!results && !searching && (
              <div className="text-center py-12 text-gray-400">
                <Search size={48} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Search for Graduate Programs</p>
                <p className="text-xs mt-1">Discover universities based on your preferences</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Recommendations Tab */}
      {activeTab === 'recommendations' && (
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {searching && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Getting AI recommendations...</p>
              </div>
            </div>
          )}

          {recommendations && !searching && (
            <div className="space-y-3">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2 text-purple-700 mb-1">
                  <Sparkles size={16} />
                  <span className="text-sm font-semibold">AI Recommendations</span>
                </div>
                <p className="text-xs text-purple-600">
                  Based on your profile and existing applications
                </p>
              </div>

              {recommendations.map((program, idx) => (
                <RecommendationCard key={idx} program={program} onAdd={onAddApplication} />
              ))}
            </div>
          )}

          {!recommendations && !searching && (
            <div className="text-center py-12 text-gray-400">
              <Sparkles size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Get AI-Powered Recommendations</p>
              <p className="text-xs mt-1">Click the tab to discover programs for you</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Program Card Component
function ProgramCard({ program, onAdd }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-gray-900">{program.school}</h4>
          <p className="text-sm text-gray-600">{program.program}</p>
          {program.location && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin size={12} className="text-gray-400" />
              <span className="text-xs text-gray-500">{program.location}</span>
            </div>
          )}
        </div>
        <div className="flex gap-1">
          {program.degrees && program.degrees.map((degree) => (
            <span
              key={degree}
              className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-md font-medium"
            >
              {degree}
            </span>
          ))}
        </div>
      </div>

      {/* Highlights */}
      {program.highlights && program.highlights.length > 0 && (
        <div className="mb-3 space-y-1">
          {program.highlights.slice(0, 2).map((highlight, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs text-gray-600">
              <span className="text-purple-500 mt-0.5">•</span>
              <span>{highlight}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <div className="flex items-center gap-1.5 text-gray-600">
          <Award size={14} className="text-purple-500" />
          <span>Rank #{program.ranking}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-600">
          <TrendingUp size={14} className="text-green-500" />
          <span>{program.acceptance_rate}% accept</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-600">
          <Calendar size={14} className="text-blue-500" />
          <span>{program.deadline}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-600">
          <DollarSign size={14} className="text-yellow-500" />
          <span>{program.funding ? 'Funding' : 'No funding'}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
        <span className="text-xs text-gray-500">
          GRE: {program.gre_required ? 'Required' : 'Optional'}
        </span>
        <span className="text-xs text-gray-300">|</span>
        <span className="text-xs text-gray-500">TOEFL: {program.toefl_min}+</span>
        <button
          onClick={() => onAdd?.(program)}
          className="ml-auto text-xs px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-md hover:shadow-lg transition-all font-medium"
        >
          Add to Board
        </button>
      </div>
    </div>
  );
}

// Recommendation Card Component
function RecommendationCard({ program, onAdd }) {
  return (
    <div className="bg-white border border-purple-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="font-semibold text-gray-900">{program.school}</h4>
          <p className="text-sm text-gray-600">{program.program}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
          program.tier === 'safety'
            ? 'bg-green-100 text-green-700'
            : program.tier === 'match'
            ? 'bg-blue-100 text-blue-700'
            : 'bg-orange-100 text-orange-700'
        }`}>
          {program.tier}
        </span>
      </div>

      <p className="text-xs text-gray-600 mb-3 line-clamp-2">{program.reasoning}</p>

      {program.highlights && (
        <div className="space-y-1 mb-3">
          {program.highlights.slice(0, 2).map((highlight, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs text-gray-600">
              <span className="text-purple-500">•</span>
              <span>{highlight}</span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => onAdd?.(program)}
        className="w-full text-xs px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-md hover:shadow-lg transition-all font-medium"
      >
        Add to Applications
      </button>
    </div>
  );
}

export default ResearchPanel;
