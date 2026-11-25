import Home from './pages/Home';
import AdminDashboard from './pages/AdminDashboard';
import ColaboradorDashboard from './pages/ColaboradorDashboard';
import RegistroGraduando from './pages/RegistroGraduando';
import __Layout from './Layout.jsx';

export const PAGES = {
    "Home": Home,
    "AdminDashboard": AdminDashboard,
    "ColaboradorDashboard": ColaboradorDashboard,
    "RegistroGraduando": RegistroGraduando,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};