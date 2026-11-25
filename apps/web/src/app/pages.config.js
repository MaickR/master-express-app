import Home from '../features/acceso/Home';
import AdminDashboard from '../features/paneles/AdminDashboard';
import ColaboradorDashboard from '../features/paneles/ColaboradorDashboard';
import RegistroGraduando from '../features/graduandos/RegistroGraduando';
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