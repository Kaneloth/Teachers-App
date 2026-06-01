import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import GeneralSettings from '@/components/settings/GeneralSettings';
import SubscriptionSettings from '@/components/settings/SubscriptionSettings';
import SecuritySettings from '@/components/settings/SecuritySettings';
import AdminSettings from '@/components/settings/AdminSettings';
import { useAuth } from '@/lib/AuthContext';

export default function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const defaultTab = (location.state as any)?.tab || 'general';
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => navigate('/home')} className="p-1.5 -ml-1.5 hover:bg-muted rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="w-full mb-6">
          <TabsTrigger value="general" className="flex-1">General</TabsTrigger>
          <TabsTrigger value="subscription" className="flex-1">Subscription</TabsTrigger>
          <TabsTrigger value="security" className="flex-1">Security</TabsTrigger>
          {isAdmin && <TabsTrigger value="admin" className="flex-1">Admin</TabsTrigger>}
        </TabsList>
        <TabsContent value="general"><GeneralSettings /></TabsContent>
        <TabsContent value="subscription"><SubscriptionSettings /></TabsContent>
        <TabsContent value="security"><SecuritySettings /></TabsContent>
        {isAdmin && <TabsContent value="admin"><AdminSettings /></TabsContent>}
      </Tabs>
    </div>
  );
}
