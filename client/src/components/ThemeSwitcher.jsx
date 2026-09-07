import { Dropdown, Button } from 'antd';
import { Palette } from 'lucide-react';
import { useThemeMode } from '../context/ThemeContext.jsx';

export default function ThemeSwitcher() {
  const { themeId, themes, setTheme } = useThemeMode();

  return (
    <Dropdown
      trigger={['click']}
      overlayClassName="theme-menu"
      menu={{
        selectable: true,
        selectedKeys: [themeId],
        onClick: ({ key }) => setTheme(key),
        items: themes.map((theme) => ({
          key: theme.id,
          label: (
            <span className="flex items-center gap-2">
              <span className="theme-swatch" style={{ background: theme.tokens['--primary-color'] }} />
              {theme.name}
            </span>
          ),
        })),
      }}
    >
      <Button type="text" className="!text-white" icon={<Palette size={18} />} aria-label="Change theme">
        <span className="hidden sm:inline">Theme</span>
      </Button>
    </Dropdown>
  );
}
