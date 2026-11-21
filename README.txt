JARVIS STAGE 2 — GEMINI AI BACKEND

WHAT THIS ADDS
- Gemini AI chat responses in Roman Hinglish.
- Follow-up conversation context.
- Optional captured-image analysis from the Android camera.
- API key stays on the backend, not in browser JavaScript.

REQUIREMENTS
- Node.js 18 or newer.
- A Gemini API key from Google AI Studio.
- Internet connection.

SETUP ON A COMPUTER
1. Extract this ZIP.
2. Open a terminal in the extracted jarvis_stage2 folder.
3. Run: npm install
4. Copy .env.example to a file named .env.
5. Put your Gemini API key after GEMINI_API_KEY= in .env.
6. Run: npm start
7. Open http://localhost:3000 in Chrome.

ANDROID NOTE
For phone camera access, the deployed website must use HTTPS.
This project needs a Node.js host for the backend. GitHub Pages alone cannot
run server.js. You can host the frontend + backend together on a Node hosting
service (for example Render or Railway), and then open its HTTPS URL on Android.

SECURITY
- Never upload .env or your API key to GitHub.
- .gitignore already excludes .env.
- Do not share your API key in screenshots or chats.
- Set usage limits/alerts in your Google Cloud/AI Studio account if available.

CAMERA NOTES
- Tap Capture frame before asking about what the camera sees.
- Phone camera capture is supported.
- ESP32-CAM stream capture may fail because of browser CORS/security rules.
  If that happens, a same-origin HTTPS proxy or ESP32 stream setup with CORS
  support is needed.
- This is visual assistance, not a reliable safety/navigation system.

TROUBLESHOOTING
- "GEMINI_API_KEY server par set nahi hai": check the .env filename and key.
- 404/model error: verify GEMINI_MODEL is available to your API key/project.
- Camera permission error: use HTTPS and allow Chrome camera permission.
