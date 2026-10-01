// Firebase dùng từ CDN chính thức: website Razor không cần React hoặc npm.
import {
  initializeApp,
  getApp,
  getApps,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

export const firebaseConfig = {
  apiKey: "AIzaSyBcaPoiBrJHz93Slc4cB2GTxPIC6CHGNg4",
  appId: "1:137996768190:web:cd1fac57120eb5fe00dfef",
  messagingSenderId: "137996768190",
  projectId: "pet-care-app-dd27b",
  authDomain: "pet-care-app-dd27b.firebaseapp.com",
  storageBucket: "pet-care-app-dd27b.firebasestorage.app",
};

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

// Razor Pages và API luôn được ASP.NET Core phục vụ cùng một origin.
export const API_BASE = "";
