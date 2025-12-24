import { Calendar, Heart, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const SEARCH_DEBOUNCE_MS = 500;

export default function TeamsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [fixtures, setFixtures] = useState({});
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingFavorites, setLoadingFavorites] = useState(true);
  const [loadingFixtures, setLoadingFixtures] = useState(false);
  const searchTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  const fetchFavorites = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/favorites/teams`, {
        credentials: 'include',
      });

      if (!isMountedRef.current) return;

      if (!response.ok) {
        throw new Error('Failed to fetch favorites');
      }

      const data = await response.json();
      setFavorites(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching favorites:', error);
      if (isMountedRef.current) {
        toast.error('Failed to load favorite teams');
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingFavorites(false);
      }
    }
  }, []);

  const fetchFixtures = useCallback(async () => {
    setLoadingFixtures(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/favorites/upcoming-matches?days=14`, {
        credentials: 'include',
      });

      if (!isMountedRef.current) return;

      if (!response.ok) {
        throw new Error('Failed to fetch fixtures');
      }

      const data = await response.json();
      setFixtures(data || {});
    } catch (error) {
      console.error('Error fetching fixtures:', error);
      if (isMountedRef.current) {
        toast.error('Failed to load fixtures');
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingFixtures(false);
      }
    }
  }, []);

  const searchTeams = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setLoadingSearch(false);
      return;
    }

    setLoadingSearch(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/teams/search?query=${encodeURIComponent(query.trim())}`, {
        credentials: 'include',
      });

      if (!isMountedRef.current) return;

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      console.log('Search results:', data);
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error searching teams:', error);
      if (isMountedRef.current) {
        toast.error('Failed to search teams');
        setSearchResults([]);
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingSearch(false);
      }
    }
  }, []);

  // Fetch favorites on mount
  useEffect(() => {
    isMountedRef.current = true;
    fetchFavorites();

    return () => {
      isMountedRef.current = false;
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [fetchFavorites]);

  // Fetch fixtures when favorites change
  useEffect(() => {
    if (favorites.length > 0) {
      fetchFixtures();
    }
  }, [favorites.length, fetchFixtures]);

  const handleSearchChange = useCallback(
    (e) => {
      const { value } = e.target;
      setSearchQuery(value);

      // Clear previous timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      // Debounce search
      searchTimeoutRef.current = setTimeout(() => {
        searchTeams(value);
      }, SEARCH_DEBOUNCE_MS);
    },
    [searchTeams]
  );

  const addToFavorites = useCallback(
    async (team) => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/favorites/teams`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            team_id: team.team_id,
            team_name: team.team_name,
            sport: team.sport,
            league: team.league,
            badge: team.team_badge,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || 'Failed to add team');
        }

        toast.success(`${team.team_name} added to favorites`);
        await fetchFavorites();
      } catch (error) {
        console.error('Error adding favorite:', error);
        toast.error(error.message || 'Failed to add team to favorites');
      }
    },
    [fetchFavorites]
  );

  const removeFromFavorites = useCallback(async (teamId, teamName) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/favorites/teams/${teamId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to remove team');
      }

      toast.success(`${teamName} removed from favorites`);
      setFavorites((prev) => prev.filter((t) => t.team_id !== teamId));
    } catch (error) {
      console.error('Error removing favorite:', error);
      toast.error('Failed to remove team from favorites');
    }
  }, []);

  const isTeamInFavorites = useCallback(
    (teamId) => {
      return favorites.some((fav) => fav.team_id === teamId);
    },
    [favorites]
  );

  // Format fixture dates
  const formatFixtureDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Teams & Fixtures</h1>
        <p className="text-xs text-text-secondary">Search for teams, add favorites, and view upcoming matches</p>
      </div>

      {/* Search Section */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
            <Input
              type="text"
              placeholder="Search for teams (e.g., Manchester United, Lakers)..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-10"
            />
          </div>

          {/* Search Results */}
          {loadingSearch && <div className="text-center py-8 text-text-secondary">Searching...</div>}

          {!loadingSearch && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
            <div className="text-center py-8 text-text-secondary">No teams found for &ldquo;{searchQuery}&rdquo;</div>
          )}

          {!loadingSearch && searchResults.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-text-secondary">Search Results ({searchResults.length})</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {searchResults.map((team) => (
                  <div
                    key={team.team_id}
                    className="flex items-center justify-between p-3 bg-[#18181B] border border-[#27272A] rounded-lg hover:border-[#3F3F46] transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {team.team_badge && (
                        <img
                          src={team.team_badge}
                          alt={team.team_name}
                          className="w-10 h-10 object-contain flex-shrink-0"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{team.team_name}</div>
                        <div className="text-xs text-text-secondary">
                          {team.league || team.sport}
                          {team.country && ` • ${team.country}`}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => addToFavorites(team)}
                      disabled={isTeamInFavorites(team.team_id)}
                      className="flex-shrink-0"
                    >
                      <Heart className={`h-4 w-4 mr-2 ${isTeamInFavorites(team.team_id) ? 'fill-current' : ''}`} />
                      {isTeamInFavorites(team.team_id) ? 'Added' : 'Add'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Favorites Section */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Heart className="h-5 w-5" />
          Favorite Teams
        </h2>

        {loadingFavorites && <div className="text-center py-8 text-text-secondary">Loading favorites...</div>}

        {!loadingFavorites && favorites.length === 0 && (
          <div className="text-center py-8 text-text-secondary">No favorite teams yet. Search and add teams above!</div>
        )}

        {!loadingFavorites && favorites.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {favorites.map((team) => (
              <div
                key={team.team_id}
                className="p-4 bg-[#18181B] border border-[#27272A] rounded-lg hover:border-[#3F3F46] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {team.team_badge && (
                      <img
                        src={team.team_badge}
                        alt={team.team_name}
                        className="w-12 h-12 object-contain flex-shrink-0"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{team.team_name}</div>
                      <div className="text-xs text-text-secondary">{team.league || team.sport}</div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeFromFavorites(team.team_id, team.team_name)}
                    className="flex-shrink-0 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Fixtures Section */}
      {favorites.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Fixtures
          </h2>

          {loadingFixtures && <div className="text-center py-8 text-text-secondary">Loading fixtures...</div>}

          {!loadingFixtures && Object.keys(fixtures).length === 0 && (
            <div className="text-center py-8 text-text-secondary">
              No upcoming fixtures found for your favorite teams
            </div>
          )}

          {!loadingFixtures && Object.keys(fixtures).length > 0 && (
            <div className="space-y-6">
              {Object.entries(fixtures)
                .sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB))
                .map(([date, dateFixtures]) => (
                  <div key={date}>
                    <h3 className="text-sm font-medium text-text-secondary mb-3">{formatFixtureDate(date)}</h3>
                    <div className="space-y-2">
                      {Array.isArray(dateFixtures) &&
                        dateFixtures.map((fixture) => (
                          <div key={fixture.fixture_id} className="p-4 bg-[#18181B] border border-[#27272A] rounded-lg">
                            <div className="flex items-center justify-between gap-4">
                              {/* Home Team */}
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {fixture.home_team_badge && (
                                  <img
                                    src={fixture.home_team_badge}
                                    alt={fixture.home_team_name}
                                    className="w-8 h-8 object-contain flex-shrink-0"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                    }}
                                  />
                                )}
                                <span className="font-medium truncate">{fixture.home_team_name}</span>
                              </div>

                              {/* VS */}
                              <div className="text-xs text-text-secondary flex-shrink-0">VS</div>

                              {/* Away Team */}
                              <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                                <span className="font-medium truncate">{fixture.away_team_name}</span>
                                {fixture.away_team_badge && (
                                  <img
                                    src={fixture.away_team_badge}
                                    alt={fixture.away_team_name}
                                    className="w-8 h-8 object-contain flex-shrink-0"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                    }}
                                  />
                                )}
                              </div>
                            </div>

                            {/* Match Details */}
                            <div className="mt-3 pt-3 border-t border-[#27272A] text-xs text-text-secondary flex items-center justify-between">
                              <span>{fixture.league}</span>
                              <div className="flex items-center gap-3">
                                {fixture.event_time && <span>{fixture.event_time}</span>}
                                {fixture.venue && <span>{fixture.venue}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
