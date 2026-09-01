// ── Edit these to configure the extension ──────────────────────────────
const CONFIG = {
  // The X/Twitter handle (no @) whose posts earn points. Case-insensitive.
  TARGET_ACCOUNT: "GoddessMomoo",

  // Points awarded per action.
  POINTS: {
    like: 5,
    retweet: 10,
  },
  LIKE_TEXTS: [
    "Such a good boy for Momo",
    "Loser, you don't deserve Momo's attention",
    "Get Momo to notice you, loser",
  ],

  RETWEET_TEXTS: [
    "Feeding Momo is the best way to show your love",
    "Pathetic you, you don't deserve Momo's attention",
    "Let's see if you can get Momo to notice you",
  ],
  RETWEET_AUDIO: [
    "audio/retweet1.mp3",
    "audio/retweet2.mp3",
    "audio/retweet3.mp3",
    "audio/retweet4.mp3",
    "audio/retweet5.mp3",
    "audio/retweet6.mp3",
  ],

  POPUP_IMAGES: [
    "images/popup1.png",
    "images/popup2.png",
    "images/popup3.png",
    "images/popup4.png",
    "images/popup5.png",
    "images/popup6.png",
    "images/popup7.png",
    "images/popup8.png",
    "images/popup9.png",
    "images/popup10.png",
    "images/popup11.png",
    "images/popup12.png",
    "images/popup13.png",
    "images/popup14.png",
    "images/popup15.png",
    "images/popup16.png",
    "images/popup17.png",
    "images/popup18.jpg",
    "images/popup19.jpg",
    "images/popup20.png",
  ],
  // Your deployed Flask backend base URL (no trailing slash).
  BACKEND_URL: "https://momo-reward-extension-1.onrender.com",
};
