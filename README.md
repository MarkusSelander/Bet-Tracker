# Bet Tracker

Professional betting analytics platform with real-time statistics and performance tracking.

## Tech Stack

### Frontend
- **React 19** - Modern UI library
- **Tailwind CSS** - Utility-first styling
- **Shadcn/UI** - Beautiful component library
- **Recharts** - Data visualization
- **React Router** - Navigation

### Backend
- **FastAPI** - High-performance Python web framework
- **Motor** - Async MongoDB driver
- **MongoDB** - NoSQL database
- **Emergent Google OAuth** - Authentication

## Features

✅ **Authentication** - Google OAuth via Emergent
✅ **Dashboard** - Real-time stats (Total Bets, ROI, P/L, Win Rate)
✅ **Bets Management** - Full CRUD with filters
✅ **Calendar View** - Monthly/weekly P/L visualization
✅ **Analytics** - 90-day cumulative charts
✅ **Tipsters & Bookmakers** - Manage sources
✅ **Multi-Currency** - USD, NOK, Units
✅ **Import/Export** - CSV functionality
✅ **Professional Design** - Dark theme with emerald accents

## Setup

### Backend

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your MongoDB URL

# Run server
uvicorn server:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
# Edit .env with your backend URL

# Run development server
npm start
```

### MongoDB

Make sure MongoDB is running locally or update `MONGO_URL` in backend/.env

```bash
# macOS (via Homebrew)
brew services start mongodb-community

# Or using Docker
docker run -d -p 27017:27017 --name mongodb mongo
```

## Environment Variables

### Backend (.env)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=bet_tracker
CORS_ORIGINS=http://localhost:3000,http://localhost:8000
```

### Frontend (.env)
```
REACT_APP_BACKEND_URL=http://localhost:8000
```

## Development

- Frontend runs on http://localhost:3000
- Backend runs on http://localhost:8000
- API docs available at http://localhost:8000/docs

## Testing Results

📊 **91% Overall Success Rate**
- Backend: 87.5% (14/16 endpoints working)
- Frontend: 95% (23/24 features functional)

## Design Enhancements

🎨 Enhanced card hover states with glow effects
🎨 Smooth stagger animations
🎨 Professional table styling
🎨 Sophisticated chart containers
🎨 Enhanced form inputs with focus glows
🎨 Animated sidebar navigation
🎨 Badge enhancements for bet results
🎨 Custom scrollbar and selection styling

## License

Private Project
