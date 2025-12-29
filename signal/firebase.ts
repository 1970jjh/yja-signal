
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, update, remove, push } from 'firebase/database';

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyDDln1Ejgl60N7ugW9vHQ-jZi-Ls5RABEg",
  authDomain: "yja-signal.firebaseapp.com",
  databaseURL: "https://yja-signal-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "yja-signal",
  storageBucket: "yja-signal.firebasestorage.app",
  messagingSenderId: "569069457688",
  appId: "1:569069457688:web:46ffa3e2a28419079a0e6d"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { database, ref, set, get, onValue, update, remove, push };
