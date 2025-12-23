import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function TipstersPage() {
  const [tipsters, setTipsters] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTipster, setNewTipster] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTipsters();
  }, []);

  const fetchTipsters = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/tipsters`, {
        credentials: 'include',
      });
      const data = response.ok ? await response.json() : null;
      setTipsters(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching tipsters:', error);
      toast.error('Failed to load tipsters');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();

    if (!newTipster.trim()) {
      toast.error('Tipster name is required');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/tipsters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newTipster }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Du er ikke innlogget. Vennligst logg inn igjen.');
          window.location.href = '/login';
          return;
        }
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Failed to add tipster');
      }

      toast.success('Tipster added successfully');
      setIsDialogOpen(false);
      setNewTipster('');
      fetchTipsters();
    } catch (error) {
      console.error('Error adding tipster:', error);
      toast.error(error.message);
    }
  };

  const handleDelete = async (tipsterId) => {
    if (!window.confirm('Are you sure you want to delete this tipster?')) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/tipsters/${tipsterId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Du er ikke innlogget. Vennligst logg inn igjen.');
          window.location.href = '/login';
          return;
        }
        throw new Error('Failed to delete tipster');
      }

      toast.success('Tipster deleted successfully');
      fetchTipsters();
    } catch (error) {
      console.error('Error deleting tipster:', error);
      toast.error('Failed to delete tipster');
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
          <h1 className="text-4xl font-bold mb-2" data-testid="tipsters-title">
            Tipsters
          </h1>
          <p className="text-text-secondary">Manage your tipster sources</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              data-testid="add-tipster-btn"
              className="btn-primary-enhanced bg-primary hover:bg-primary/90 text-black font-bold shadow-[0_0_15px_rgba(16,185,129,0.4)]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Tipster
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#18181B] border-[#27272A] text-white">
            <DialogHeader>
              <DialogTitle>Add New Tipster</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <Label htmlFor="name">Tipster Name</Label>
                <Input
                  id="name"
                  value={newTipster}
                  onChange={(e) => setNewTipster(e.target.value)}
                  placeholder="e.g., John Doe"
                  className="bg-black/20 border-white/10"
                  required
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="secondary" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-black font-bold">
                  Add Tipster
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tipsters.length === 0 ? (
          <div className="col-span-full text-center py-12 text-text-muted">
            No tipsters found. Add your first tipster!
          </div>
        ) : (
          tipsters.map((tipster) => (
            <div key={tipster.tipster_id} className="stat-card glass-panel border border-[#27272A] rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold mb-1">{tipster.name}</h3>
                  <p className="text-sm text-text-muted">Added {new Date(tipster.created_at).toLocaleDateString()}</p>
                </div>
                <button
                  data-testid={`delete-tipster-${tipster.tipster_id}`}
                  onClick={() => handleDelete(tipster.tipster_id)}
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
