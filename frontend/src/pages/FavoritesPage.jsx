import { Calendar, MapPin, Plus, Star, Trash2, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useToast } from '../hooks/use-toast';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const FavoritesPage = () => {
  const [favoriteTeams, setFavoriteTeams] = useState([]);
  const [upcomingMatches, setUpcomingMatches] = useState({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchFavorites();
    fetchUpcomingMatches();
  }, []);

  const fetchFavorites = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/favorites/teams`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setFavoriteTeams(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUpcomingMatches = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/favorites/upcoming-matches?days=14`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        // Ensure upcomingMatches is an object with array values
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          const validatedData = {};
          Object.entries(data).forEach(([key, value]) => {
            validatedData[key] = Array.isArray(value) ? value : [];
          });
          setUpcomingMatches(validatedData);
        } else {
          setUpcomingMatches({});
        }
      }
    } catch (error) {
      console.error('Error fetching matches:', error);
    }
  };

  const removeFavorite = async (teamId) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/favorites/teams/${teamId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        setFavoriteTeams(favoriteTeams.filter((team) => team.team_id !== teamId));
        toast({
          title: 'Team removed',
          description: 'Team removed from favorites',
        });
        fetchUpcomingMatches();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove team',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [, month, day] = dateStr.split('-');
    return `${day}/${month}`;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Star className="w-6 h-6 text-yellow-500" />
          Favorite Teams
        </h1>
        <TeamSearchDialog onTeamAdded={fetchFavorites} />
      </div>

      {/* Favorite Teams Grid */}
      {favoriteTeams.length === 0 ? (
        <Card className="p-8 text-center">
          <Star className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No favorite teams yet</p>
          <TeamSearchDialog onTeamAdded={fetchFavorites} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {favoriteTeams.map((team) => (
            <Card key={team.team_id} className="p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  {team.team_badge && (
                    <img src={team.team_badge} alt={team.team_name} className="w-12 h-12 object-contain" />
                  )}
                  <div>
                    <h3 className="font-semibold">{team.team_name}</h3>
                    <Badge variant="secondary" className="text-xs mt-1">
                      {team.sport}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFavorite(team.team_id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              {team.league && (
                <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
                  <Trophy className="w-3 h-3" />
                  {team.league}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Upcoming Matches */}
      {Object.keys(upcomingMatches).length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Upcoming Matches
          </h2>

          <div className="space-y-6">
            {Object.entries(upcomingMatches)
              .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
              .map(([date, matches]) => (
                <div key={date}>
                  <h3 className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {formatDate(date)}
                  </h3>
                  <div className="space-y-2">
                    {matches.map((match) => (
                      <Card key={match.fixture_id} className="p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3 flex-1">
                                {match.home_team_badge && (
                                  <img
                                    src={match.home_team_badge}
                                    alt={match.home_team_name}
                                    className="w-8 h-8 object-contain"
                                  />
                                )}
                                <span className="font-medium">{match.home_team_name}</span>
                              </div>
                              <span className="text-xs text-gray-500 mx-2">vs</span>
                              <div className="flex items-center gap-3 flex-1 justify-end">
                                <span className="font-medium">{match.away_team_name}</span>
                                {match.away_team_badge && (
                                  <img
                                    src={match.away_team_badge}
                                    alt={match.away_team_name}
                                    className="w-8 h-8 object-contain"
                                  />
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              {match.event_time && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {match.event_time}
                                </span>
                              )}
                              {match.venue && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {match.venue}
                                </span>
                              )}
                              {match.league && (
                                <Badge variant="outline" className="text-xs">
                                  {match.league}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {favoriteTeams.length > 0 && Object.keys(upcomingMatches).length === 0 && (
        <Card className="p-8 text-center">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No upcoming matches in the next 14 days</p>
        </Card>
      )}
    </div>
  );
};

// Team Search Dialog Component
const TeamSearchDialog = ({ onTeamAdded }) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedSport, setSelectedSport] = useState('all');
  const [searching, setSearching] = useState(false);
  const { toast } = useToast();

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const sportParam = selectedSport !== 'all' ? `&sport=${selectedSport}` : '';
        const response = await fetch(
          `${BACKEND_URL}/api/teams/search?query=${encodeURIComponent(searchQuery)}${sportParam}`,
          { credentials: 'include' }
        );
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data);
        }
      } catch (error) {
        console.error('Error searching teams:', error);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedSport]);

  const addTeam = async (team) => {
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

      if (response.ok) {
        toast({
          title: 'Team added',
          description: `${team.team_name} added to favorites`,
        });
        setOpen(false);
        setSearchQuery('');
        setSearchResults([]);
        onTeamAdded();
      } else if (response.status === 400) {
        toast({
          title: 'Already in favorites',
          description: 'This team is already in your favorites',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add team',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Team
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Favorite Team</DialogTitle>
          <DialogDescription>Search for a team to add to your favorites</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Label htmlFor="search">Team Name</Label>
              <Input
                id="search"
                placeholder="Search teams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="sport">Sport</Label>
              <Select value={selectedSport} onValueChange={setSelectedSport}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sports</SelectItem>
                  <SelectItem value="soccer">Soccer</SelectItem>
                  <SelectItem value="basketball">Basketball</SelectItem>
                  <SelectItem value="american football">American Football</SelectItem>
                  <SelectItem value="ice hockey">Ice Hockey</SelectItem>
                  <SelectItem value="baseball">Baseball</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {searching && <div className="text-center py-8 text-gray-500">Searching...</div>}

          {!searching && searchResults.length === 0 && searchQuery.length >= 2 && (
            <div className="text-center py-8 text-gray-500">No teams found</div>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {searchResults.map((team) => (
                <Card
                  key={team.team_id}
                  className="p-3 hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => addTeam(team)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      {team.team_badge && (
                        <img src={team.team_badge} alt={team.team_name} className="w-10 h-10 object-contain" />
                      )}
                      <div className="flex-1">
                        <div className="font-medium">{team.team_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {team.league} {team.country && `• ${team.country}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{team.sport}</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          addTeam(team);
                        }}
                        className="h-8"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FavoritesPage;
