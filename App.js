// App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n'; // Import your i18n configuration
import HomePage from './components/HomePage';
import ContactForm from './components/home/GetInTouch';
import Login from './components/home/Login';
import PrivacyPolicy from './components/home/PrivacyPolicy';
import AdminDashboard from './components/admin/AdminDashboard';
import UserDashboard from './components/user/UserDashboard';
import OrganizerDashboard from './components/organizer/OrganizerDashboard';
import AddUser from './components/admin/AddUser';
import UserPaymentDetails from './components/organizer/UserpaymentDetails';
import Notifications from './components/Notifications/Notifications';
import LanguageSwitcher from './components/LanguageSwitcher';
import Tracking from './components/user/Tracking';
import IncomeForm from './components/user/IncomeForm';
import ExpenseForm from './components/user/ExpenseForm';
import SavingsForm from './components/user/SavingsForm';
import Navigation from './components/Navigation/Navigation';
import Sidebar from './components/sidebar/Sidebar';
import PaymentSchedulePage from './components/user/PaymentSchedulePage';
import ChangePassword from './components/changePassword/ChangePasswordForm';
import ChangePasswordForm from './components/changePassword/ChangePasswordForm';
import AddUserPage from './components/organizer/AddUserPage';
import Approach from './components/admin/Approach';
import Profile from './components/profile/Profile'; // Import Profile component
import LoadingAnimation from './components/animations/LoadingAnimation';
import Calendar from './components/calendar/Calendar';
import EditSavingsGoal from './components/user/EditSavingsGoal';
import axios from 'axios';

// Configure Axios defaults
axios.defaults.withCredentials = true;
axios.interceptors.request.use(config => {
  config.headers = {
    ...config.headers,
    'Content-Type': 'application/json'
  };
  return config;
});

// import 'bootstrap/dist/css/bootstrap.min.css';

const App = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000); // 2 seconds loading animation

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <LoadingAnimation />;
  }

  return (
    <I18nextProvider i18n={i18n}>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/contact" element={<ContactForm />} />
          <Route path="/login" element={<Login />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/organizer" element={<OrganizerDashboard />} />
          <Route path="/user" element={<UserDashboard />} />
          <Route path="/user-payments/:userId" element={<UserPaymentDetails />} />
          <Route path="/add-admin" element={<AddUser role="admin" />} />
          <Route path="/add-organizer" element={<AddUser role="organizer" />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/tracking" element={<Tracking />} />
          <Route path="/tracking/income-form" element={<IncomeForm />} />
          <Route path="/tracking/expense-form" element={<ExpenseForm />} />
          <Route path="/tracking/savings-form" element={<SavingsForm />} />
          <Route path="/tracking/savings-form/:goalId" element={<EditSavingsGoal />} />
          <Route path="/payment-schedule" element={<PaymentSchedulePage />} />
          <Route path="/change-password" element={<ChangePasswordForm />} />
          <Route path="/dashboard" element={<UserDashboard />} />
          <Route path="/add-user" element={<AddUserPage />} />
          <Route path="/approach" element={<Approach />} />
          <Route path="/profile" element={<Profile />} /> {/* Add this route */}
          <Route path="/calendar" element={<Calendar />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </I18nextProvider>
  );
};

export default App;

