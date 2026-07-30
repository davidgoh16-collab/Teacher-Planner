import React, { useState, useEffect, useCallback } from 'react';
import { Bot, BookMarked, Palette, Plug, Loader2 } from 'lucide-react';
import { TeacherSkill, BrandKit, CustomAgent, McpServerConfig } from '../../types';
import {
  fetchSkills, fetchBrandKit, fetchCustomAgents, fetchMcpServers,
} from '../../services/aiHubService';
import PageHeading from '../ui/PageHeading';
import SegmentedControl from '../ui/SegmentedControl';
import AgentsSection from './AgentsSection';
import SkillsSection from './SkillsSection';
import BrandKitSection from './BrandKitSection';
import ConnectionsSection from './ConnectionsSection';

/**
 * Everything that shapes how the AI works for this teacher, in one place: the assistants they've
 * defined, the formats they've taught it, their school's branding, and any external tools.
 *
 * Deliberately its own tab rather than more Settings panels — these are things teachers build and
 * come back to, not switches they set once.
 */

export type AIHubSection = 'agents' | 'skills' | 'brand' | 'connections';

interface AIHubViewProps {
  /** Opens a chat with the given custom agent selected. */
  onUseAgent?: (agent: CustomAgent) => void;
}

const AIHubView: React.FC<AIHubViewProps> = ({ onUseAgent }) => {
  const [section, setSection] = useState<AIHubSection>('agents');
  const [loading, setLoading] = useState(true);
  const [skills, setSkills] = useState<TeacherSkill[]>([]);
  const [agents, setAgents] = useState<CustomAgent[]>([]);
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [brand, setBrand] = useState<BrandKit | null>(null);

  const refresh = useCallback(async () => {
    const [s, a, m, b] = await Promise.all([
      fetchSkills(), fetchCustomAgents(), fetchMcpServers(), fetchBrandKit(),
    ]);
    setSkills(s); setAgents(a); setServers(m); setBrand(b);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div>
      <PageHeading
        title="AI Hub"
        sub="Teach the assistant how you work, and build your own."
      />

      <div className="mb-5">
        <SegmentedControl<AIHubSection>
          ariaLabel="AI Hub sections"
          value={section}
          onChange={setSection}
          options={[
            { value: 'agents', label: 'Assistants', icon: <Bot className="h-3.5 w-3.5" /> },
            { value: 'skills', label: 'Skills', icon: <BookMarked className="h-3.5 w-3.5" /> },
            { value: 'brand', label: 'Branding', icon: <Palette className="h-3.5 w-3.5" /> },
            { value: 'connections', label: 'Connections', icon: <Plug className="h-3.5 w-3.5" /> },
          ]}
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-slate-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {section === 'agents' && (
            <AgentsSection agents={agents} skills={skills} servers={servers} onRefresh={refresh} onUseAgent={onUseAgent} />
          )}
          {section === 'skills' && <SkillsSection skills={skills} onRefresh={refresh} />}
          {section === 'brand' && brand && <BrandKitSection brand={brand} onRefresh={refresh} />}
          {section === 'connections' && <ConnectionsSection servers={servers} onRefresh={refresh} />}
        </>
      )}
    </div>
  );
};

export default AIHubView;
