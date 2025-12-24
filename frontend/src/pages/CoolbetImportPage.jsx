import { AlertCircle, BookOpen, CheckCircle2, Copy, Download, ExternalLink, Shield, Zap } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { COOLBET_BOOKMARKLET_DEV, COOLBET_BOOKMARKLET_PROD } from '../utils/coolbetBookmarkletMinified';

const CoolbetImportPage = () => {
  const [copiedDev, setCopiedDev] = useState(false);
  const [copiedProd, setCopiedProd] = useState(false);

  // Determine which bookmarklet to use based on environment
  const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  const bookmarkletToUse = isDevelopment ? COOLBET_BOOKMARKLET_DEV : COOLBET_BOOKMARKLET_PROD;

  const handleCopy = async (text, setterFn) => {
    try {
      await navigator.clipboard.writeText(text);
      setterFn(true);
      setTimeout(() => setterFn(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard. Please copy manually.');
    }
  };

  return (
    <div className="max-w-5xl p-6 mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Download className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Import from Coolbet</h1>
        </div>
        <p className="text-gray-600">Import your bet history from Coolbet using a secure browser bookmarklet</p>
      </div>

      {/* How It Works */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            How It Works
          </CardTitle>
          <CardDescription>A simple, secure way to import your Coolbet bet history</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col items-center p-4 text-center border rounded-lg">
              <div className="flex items-center justify-center w-12 h-12 mb-3 bg-blue-100 rounded-full">
                <span className="text-xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="mb-2 font-semibold">Add Bookmarklet</h3>
              <p className="text-sm text-gray-600">Drag the button below to your bookmarks bar or copy the code</p>
            </div>

            <div className="flex flex-col items-center p-4 text-center border rounded-lg">
              <div className="flex items-center justify-center w-12 h-12 mb-3 bg-blue-100 rounded-full">
                <span className="text-xl font-bold text-blue-600">2</span>
              </div>
              <h3 className="mb-2 font-semibold">Visit Coolbet</h3>
              <p className="text-sm text-gray-600">Log into Coolbet and navigate to your bet history page</p>
            </div>

            <div className="flex flex-col items-center p-4 text-center border rounded-lg">
              <div className="flex items-center justify-center w-12 h-12 mb-3 bg-blue-100 rounded-full">
                <span className="text-xl font-bold text-blue-600">3</span>
              </div>
              <h3 className="mb-2 font-semibold">Click & Import</h3>
              <p className="text-sm text-gray-600">
                Click the bookmarklet to extract and import your bets automatically
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security & Privacy */}
      <Alert className="mb-6 border-green-200 bg-green-50">
        <Shield className="w-4 h-4 text-green-600" />
        <AlertDescription className="text-green-800">
          <strong className="font-semibold">100% Secure & Private</strong>
          <ul className="mt-2 ml-4 space-y-1 text-sm list-disc">
            <li>Runs entirely in your browser - no backend scraping</li>
            <li>No Coolbet credentials are stored or transmitted</li>
            <li>Only bet data (stakes, odds, results) is sent to your account</li>
            <li>Open source code - you can inspect exactly what it does</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Bookmarklet Installation */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Install Bookmarklet
          </CardTitle>
          <CardDescription>Choose one of the methods below to add the bookmarklet to your browser</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Method 1: Drag and Drop */}
          <div>
            <h3 className="flex items-center gap-2 mb-3 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              Method 1: Drag to Bookmarks Bar (Recommended)
            </h3>
            <div className="p-4 border-2 border-gray-300 border-dashed rounded-lg bg-gray-50">
              <p className="mb-3 text-sm text-gray-600">Drag this button to your browser's bookmarks bar:</p>
              <a
                href={bookmarkletToUse}
                className="inline-flex items-center gap-2 px-6 py-3 font-semibold text-white transition-colors bg-blue-600 rounded-lg cursor-move hover:bg-blue-700"
                onClick={(e) => {
                  // Prevent navigation in the app
                  if (!e.currentTarget.parentElement.classList.contains('bookmark-bar')) {
                    e.preventDefault();
                    alert("Drag this button to your bookmarks bar!\n\nIf you can't drag it, use Method 2 or 3 below.");
                  }
                }}
              >
                📊 Import Coolbet Bets
              </a>
              <p className="mt-3 text-xs text-gray-500">
                Your bookmarks bar is usually at the top of your browser. If you don't see it:
                <br />
                <strong>Chrome/Edge:</strong> Press Ctrl+Shift+B (Windows) or Cmd+Shift+B (Mac)
                <br />
                <strong>Firefox:</strong> Press Ctrl+Shift+B (Windows) or Cmd+Shift+B (Mac)
              </p>
            </div>
          </div>

          {/* Method 2: Manual Bookmark Creation */}
          <div>
            <h3 className="flex items-center gap-2 mb-3 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              Method 2: Create Bookmark Manually
            </h3>
            <div className="space-y-3">
              <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
                <li>Copy the bookmarklet code below</li>
                <li>Create a new bookmark in your browser (Ctrl+D / Cmd+D)</li>
                <li>Name it "Import Coolbet Bets"</li>
                <li>Paste the code as the URL/Location</li>
                <li>Save the bookmark</li>
              </ol>

              <div className="relative">
                <div className="p-4 overflow-x-auto font-mono text-xs text-gray-100 bg-gray-900 rounded-lg">
                  <code className="break-all">{bookmarkletToUse}</code>
                </div>
                <Button
                  onClick={() => handleCopy(bookmarkletToUse, isDevelopment ? setCopiedDev : setCopiedProd)}
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                >
                  {(isDevelopment ? copiedDev : copiedProd) ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" />
                      Copy Code
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Method 3: Direct Test (Development Only) */}
          {isDevelopment && (
            <div>
              <h3 className="flex items-center gap-2 mb-3 font-semibold">
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                Method 3: Test Now (Development Only)
              </h3>
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertDescription className="text-yellow-800">
                  <p className="mb-3">
                    For testing purposes, you can open Coolbet in a new tab and then run the bookmarklet code directly
                    in the browser console.
                  </p>
                  <Button
                    onClick={() => {
                      window.open('https://www.coolbet.com', '_blank');
                      alert(
                        'Test Instructions:\n\n' +
                          '1. Log into Coolbet in the new tab\n' +
                          '2. Navigate to your bet history\n' +
                          '3. Open browser console (F12)\n' +
                          '4. Paste the bookmarklet code (without "javascript:")\n' +
                          '5. Press Enter'
                      );
                    }}
                    variant="outline"
                    className="text-yellow-700 border-yellow-300 hover:bg-yellow-100"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Coolbet for Testing
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Instructions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Usage Instructions</CardTitle>
          <CardDescription>Follow these steps each time you want to import bets</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            <li className="flex gap-3">
              <Badge className="flex items-center justify-center w-6 h-6 rounded-full shrink-0">1</Badge>
              <div>
                <strong className="block mb-1">Log into Coolbet</strong>
                <p className="text-sm text-gray-600">Open Coolbet.com in your browser and log in to your account</p>
              </div>
            </li>

            <li className="flex gap-3">
              <Badge className="flex items-center justify-center w-6 h-6 rounded-full shrink-0">2</Badge>
              <div>
                <strong className="block mb-1">Navigate to Bet History</strong>
                <p className="text-sm text-gray-600">
                  Find and open your bet history page. Make sure the bets have loaded.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <Badge className="flex items-center justify-center w-6 h-6 rounded-full shrink-0">3</Badge>
              <div>
                <strong className="block mb-1">Make sure you're logged into this app</strong>
                <p className="text-sm text-gray-600">
                  The bookmarklet needs you to be authenticated. Keep this app open in another tab.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <Badge className="flex items-center justify-center w-6 h-6 rounded-full shrink-0">4</Badge>
              <div>
                <strong className="block mb-1">Click the Bookmarklet</strong>
                <p className="text-sm text-gray-600">
                  Click the "Import Coolbet Bets" bookmark you created. The import will start automatically.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <Badge className="flex items-center justify-center w-6 h-6 rounded-full shrink-0">5</Badge>
              <div>
                <strong className="block mb-1">Review Results</strong>
                <p className="text-sm text-gray-600">
                  You'll see a summary of how many bets were imported. Duplicates are automatically skipped.
                </p>
              </div>
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Important Notes */}
      <Card className="mb-6 border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-900">
            <AlertCircle className="w-5 h-5" />
            Important Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <strong className="text-orange-900">Page Structure Changes:</strong>
            <p className="text-gray-700">
              If Coolbet updates their website design, the bookmarklet may need updates. The selectors used to extract
              bet data are based on common betting site patterns.
            </p>
          </div>

          <div>
            <strong className="text-orange-900">Pagination:</strong>
            <p className="text-gray-700">
              The bookmarklet only imports bets visible on the current page. If you have many bets, you may need to load
              more or navigate through pages.
            </p>
          </div>

          <div>
            <strong className="text-orange-900">Browser Compatibility:</strong>
            <p className="text-gray-700">
              Works best in modern browsers (Chrome, Firefox, Edge, Safari). Make sure JavaScript is enabled and pop-ups
              are allowed for Coolbet.
            </p>
          </div>

          <div>
            <strong className="text-orange-900">Data Privacy:</strong>
            <p className="text-gray-700">
              All extraction happens in your browser. Only bet data is sent to your account. No passwords or personal
              information are transmitted.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Troubleshooting */}
      <Card>
        <CardHeader>
          <CardTitle>Troubleshooting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <strong className="text-gray-900">No bets found:</strong>
            <ul className="mt-1 ml-2 space-y-1 text-sm text-gray-600 list-disc list-inside">
              <li>Ensure you're on the bet history page, not another page</li>
              <li>Wait for the page to fully load before clicking the bookmarklet</li>
              <li>Check that you have bet history on Coolbet</li>
            </ul>
          </div>

          <div>
            <strong className="text-gray-900">Import failed / Authentication error:</strong>
            <ul className="mt-1 ml-2 space-y-1 text-sm text-gray-600 list-disc list-inside">
              <li>Make sure you're logged into this analytics app</li>
              <li>Try refreshing this page and logging in again</li>
              <li>Check that cookies are enabled for this site</li>
            </ul>
          </div>

          <div>
            <strong className="text-gray-900">Bookmarklet doesn't work:</strong>
            <ul className="mt-1 ml-2 space-y-1 text-sm text-gray-600 list-disc list-inside">
              <li>Ensure the entire code was copied, including "javascript:"</li>
              <li>Try creating the bookmark manually (Method 2)</li>
              <li>Check browser console (F12) for error messages</li>
            </ul>
          </div>

          <div>
            <strong className="text-gray-900">Still having issues?</strong>
            <p className="mt-1 ml-2 text-sm text-gray-600">
              Open your browser's developer console (F12) and look for error messages. The bookmarklet logs detailed
              information that can help diagnose problems.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CoolbetImportPage;
