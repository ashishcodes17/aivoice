// Generated from recorded test calls; the caller side is scripted text, the agent audio is the real output.
export type DemoLine = { who: "agent" | "caller"; text: string; at?: number };
export type DemoCall = { id: string; tab: string; agent: string; language: string; outcome: string; audio: string; duration: number; lines: DemoLine[] };

export const demoCalls: DemoCall[] = [
  {
    "id": "emi-hi",
    "tab": "EMI reminder",
    "agent": "Reena · Mitra Finance",
    "language": "Hindi",
    "outcome": "Customer promised to pay on the 7th by UPI",
    "audio": "/demo/emi-hi.m4a",
    "duration": 50.8,
    "lines": [
      {
        "who": "caller",
        "text": "हेलो?"
      },
      {
        "who": "agent",
        "text": "नमस्ते जी! मैं रीना बोल रही हूँ, मित्र फाइनेंस से। आपकी ईएमआई की डेट पास आ रही है, उसी के बारे में कॉल किया है। क्या अभी दो मिनट बात हो सकती है?",
        "at": 0.0
      },
      {
        "who": "caller",
        "text": "हाँ बोलिए, पर जल्दी बताइए, मैं थोड़ा बिज़ी हूँ।"
      },
      {
        "who": "agent",
        "text": "जी, आपकी दो पहिया गाड़ी की loan ईएमआई तीन हज़ार दो सौ रुपये इस महीने की पांच तारीख को due है। आप payment कैसे करेंगे, app से, UPI से या branch जाकर?",
        "at": 14.36
      },
      {
        "who": "caller",
        "text": "देखिए, सैलरी लेट हो गई है, पैसा सात तारीख को आएगा। लेट फीस माफ हो सकती है क्या?"
      },
      {
        "who": "agent",
        "text": "समझ सकती हूँ, अगर due date के बाद payment होता है तो दो सौ रुपये late fee लग सकती है। मैं waiver का वादा नहीं कर सकती, पर अगर परेशानी हो तो team options discuss कर लेगी।",
        "at": 28.7
      },
      {
        "who": "caller",
        "text": "ठीक है, सात तारीख को UPI से पे कर दूँगा। bye!"
      },
      {
        "who": "agent",
        "text": "ठीक है जी, धन्यवाद! नमस्ते!",
        "at": 47.12
      }
    ]
  },
  {
    "id": "restaurant-en",
    "tab": "Table booking",
    "agent": "Meera · Spice Route",
    "language": "English",
    "outcome": "Table for six confirmed, Saturday 8:30 PM",
    "audio": "/demo/restaurant-en.m4a",
    "duration": 52.1,
    "lines": [
      {
        "who": "caller",
        "text": "Hello?"
      },
      {
        "who": "agent",
        "text": "Hi! This is Meera from Spice Route restaurant. You asked for a table booking on our website, so I'm calling to confirm it. Is this a good time?",
        "at": 0.0
      },
      {
        "who": "caller",
        "text": "Yeah, hi Meera, this is good. So I wanted a table for 6 on Saturday at 8, two of them are kids."
      },
      {
        "who": "agent",
        "text": "Got it, so that's four adults and two kids for Saturday the 31st at 8 PM. Is that right?",
        "at": 10.56
      },
      {
        "who": "caller",
        "text": "Actually make it 8:30 instead of 8. And we're all vegetarian, so do you have good veg options?"
      },
      {
        "who": "agent",
        "text": "Sure, Saturday the 31st at 8:30 PM for six people, including kids. We have plenty of vegetarian dishes, and a separate Jain menu on request. Does that work for you?",
        "at": 19.22
      },
      {
        "who": "caller",
        "text": "That works. Also, is there parking, and can you do something for a birthday?"
      },
      {
        "who": "agent",
        "text": "Yes, we have free valet parking. For a birthday, you can bring your own cake, or the team can arrange one from outside for five hundred rupees extra. Shall I go ahead and confirm this booking?",
        "at": 34.96
      },
      {
        "who": "caller",
        "text": "Yeah, please confirm it, we'll bring our own cake. Thanks, Meera."
      },
      {
        "who": "agent",
        "text": "Alright, thank you! Bye!",
        "at": 48.28
      }
    ]
  }
];
