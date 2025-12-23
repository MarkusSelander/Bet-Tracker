import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function BookmakersPage() {
  const [bookmakers, setBookmakers] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newBookmaker, setNewBookmaker] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookmakers();
  }, []);

  const fetchBookmakers = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/bookmakers`, {
        credentials: 'include',
      });
      const data = response.ok ? await response.json() : null;
      setBookmakers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching bookmakers:', error);
      toast.error('Failed to load bookmakers');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();

    if (!newBookmaker.trim()) {
      toast.error('Bookmaker name is required');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/bookmakers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newBookmaker }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to add bookmaker');
      }

      toast.success('Bookmaker added successfully');
      setIsDialogOpen(false);
      setNewBookmaker('');
      fetchBookmakers();
    } catch (error) {
      console.error('Error adding bookmaker:', error);
      toast.error(error.message);
    }
  };

  const handleDelete = async (bookmakerId) => {
    if (!window.confirm('Are you sure you want to delete this bookmaker?')) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/bookmakers/${bookmakerId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to delete bookmaker');

      toast.success('Bookmaker deleted successfully');
      fetchBookmakers();
    } catch (error) {
      console.error('Error deleting bookmaker:', error);
      toast.error('Failed to delete bookmaker');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2" data-testid="bookmakers-title">
            Bookmakers
          </h1>
          <p className="text-text-secondary">Manage your bookmaker accounts</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              data-testid="add-bookmaker-btn"
              className="btn-primary-enhanced bg-primary hover:bg-primary/90 text-black font-bold shadow-[0_0_15px_rgba(16,185,129,0.4)]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Bookmaker
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#18181B] border-[#27272A] text-white">
            <DialogHeader>
              <DialogTitle>Add New Bookmaker</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <Label htmlFor="name">Bookmaker Name</Label>
                <Input
                  id="name"
                  value={newBookmaker}
                  onChange={(e) => setNewBookmaker(e.target.value)}
                  placeholder="e.g., Bet365"
                  className="bg-black/20 border-white/10"
                  required
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="secondary" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-black font-bold">
                  Add Bookmaker
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bookmakers.length === 0 ? (
          <div className="col-span-full text-center py-12 text-text-muted">
            No bookmakers found. Add your first bookmaker!
          </div>
        ) : (
          bookmakers.map((bookmaker) => (
            <div key={bookmaker.bookmaker_id} className="stat-card glass-panel border border-[#27272A] rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold mb-1">{bookmaker.name}</h3>
                  <p className="text-sm text-text-muted">Added {new Date(bookmaker.created_at).toLocaleDateString()}</p>
                </div>
                <button
                  data-testid={`delete-bookmaker-${bookmaker.bookmaker_id}`}
                  onClick={() => handleDelete(bookmaker.bookmaker_id)}
                  className="p-2 hover:bg-white/10 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
