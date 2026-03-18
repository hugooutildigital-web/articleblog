import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Articles from "@/pages/Articles";
import Scheduler from "@/pages/Scheduler";
import Sites from "@/pages/Sites";
import NewArticle from "@/pages/NewArticle";
import BlogList from "@/pages/BlogList";
import BlogArticle from "@/pages/BlogArticle";
import IntegrationGuide from "@/pages/IntegrationGuide";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/articles" element={<Articles />} />
            <Route path="/scheduler" element={<Scheduler />} />
            <Route path="/sites" element={<Sites />} />
            <Route path="/new-article" element={<NewArticle />} />
          </Route>
          <Route path="/blog" element={<BlogList />} />
          <Route path="/blog/:slug" element={<BlogArticle />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
