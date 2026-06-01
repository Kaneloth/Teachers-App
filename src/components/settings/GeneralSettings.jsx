import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, Sun, Type, Shield, FileText, HeadphonesIcon, ChevronRight } from 'lucide-react';

const TEXT_SIZES = ['Small', 'Medium', 'Large'];
const TEXT_SIZE_MAP = { Small: '14px', Medium: '16px', Large: '19px' };

function applyTextSize(size) {
  document.documentElement.style.fontSize = TEXT_SIZE_MAP[size];
  localStorage.setItem('textSize', size);
}

export default function GeneralSettings() {
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [textSize, setTextSize] = useState(() => localStorage.getItem('textSize') || 'Medium');

  const handleDarkMode = (v) => {
    setDarkMode(v);
    document.documentElement.classList.toggle('dark', v);
  };

  const handleTextSize = (size) => {
    setTextSize(size);
    applyTextSize(size);
  };

  return (
    <div className="space-y-4">
      {/* Toggles */}
      <div className="bg-card rounded-2xl border border-border divide-y divide-border">
        <SettingRow icon={Bell} label="Notifications" description="Push and in-app alerts">
          <Switch checked={notifications} onCheckedChange={setNotifications} />
        </SettingRow>
        <SettingRow icon={Sun} label="Dark Mode" description="Switch to dark theme">
          <Switch checked={darkMode} onCheckedChange={handleDarkMode} />
        </SettingRow>
      </div>

      {/* Text Size */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Type className="w-4 h-4 text-primary" />
          </div>
          <Label className="font-medium">Text Size</Label>
        </div>
        <div className="flex gap-2">
          {TEXT_SIZES.map(size => (
            <button
              key={size}
              onClick={() => handleTextSize(size)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                textSize === size
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Links */}
      <div className="bg-card rounded-2xl border border-border divide-y divide-border">
        <LinkRow icon={Shield} label="Privacy Policy" href="https://transfer.app/privacy" />
        <LinkRow icon={FileText} label="Terms of Service" href="https://transfer.app/terms" />
        <LinkRow icon={HeadphonesIcon} label="Contact Support" href="mailto:support@transfer.app" />
      </div>
    </div>
  );
}

function SettingRow({ icon: Icon, label, description, children }) {
  return (
    <div className="flex items-center justify-between p-4 gap-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function LinkRow({ icon: Icon, label, href }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="flex items-center justify-between p-4 gap-3 hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <p className="text-sm font-medium text-foreground">{label}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </a>
  );
}