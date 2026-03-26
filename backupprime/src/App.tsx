import { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { ProjectDetail } from './components/ProjectDetail';
import { ProjectCreation } from './components/ProjectCreation';
import { Profile } from './components/Profile';
import { Landing } from './components/Landing';
import { AdminDashboard } from './components/AdminDashboard';
import { Settings } from './components/Settings';
import { defaultLandingContent, LandingContent } from './data/landingContent';
import { apiClient } from './lib/apiClient';

export type UserRole = 'student' | 'faculty' | 'admin';

export interface User {
  id: string;
  username: string;
  email?: string;
  name: string;
  role: UserRole;
}

export type ProjectStatus = 'public' | 'locked' | 'approved';

export interface TeamMember {
  name: string;
  email: string;
  contribution: string;
  role: 'owner' | 'lead' | 'developer' | 'designer' | 'researcher' | 'contributor';
}

export interface ProjectChange {
  id: string;
  action: 'file_upload' | 'project_update' | 'access_change' | 'commit' | string;
  author: string;
  details: string;
  timestamp: string;
  files?: { id?: string; name: string; size?: number; type?: string }[];
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  path?: string;
  content?: string;
}

export interface Project {
  id: string;
  title: string;
  abstract: string;
  domains: string[];
  year: string;
  license: string;
  techStack: string[];
  status: ProjectStatus;
  owner: string;
  ownerId: string;
  teamMembers: TeamMember[];
  uploadedFiles?: UploadedFile[];
  history?: ProjectChange[];
  createdAt: string;
  lastUpdated: string;
  approvedFacultyIds?: string[]; // Track which faculty members have been granted access
  approvalStatus?: 'pending' | 'approved' | 'rejected'; // Admin approval status
  repositoryUrl?: string; // Git repository URL
  readmeContent?: string;
}

export interface AccessRequest {
  id: string;
  projectId: string;
  facultyId: string;
  facultyName: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: string;
}

export type ViewType = 'dashboard' | 'project-detail' | 'create-project' | 'profile' | 'settings';

function App() {
  const USER_STORAGE_KEY = 'prime_academic_hub_current_user';
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [showLogin, setShowLogin] = useState(false);
  const [landingContent, setLandingContent] = useState<LandingContent>(defaultLandingContent);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    if (stored) {
      try {
        const parsedUser = JSON.parse(stored) as User;
        setCurrentUser(parsedUser);
      } catch (e) {
        console.warn('Failed to restore user from localStorage', e);
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
      setShowLogin(false);
      setCurrentView('dashboard');
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, [currentUser]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setCurrentView('dashboard');
    // Add user to users list if not already present
    if (!allUsers.find(u => u.username === user.username)) {
      setAllUsers([...allUsers, user]);
    }
  };

  const handleUpdateUser = async (updatedUser: User) => {
    try {
      const result = await apiClient.updateUser(updatedUser.id, updatedUser);
      if (result.error) throw new Error(result.error);
      setCurrentUser(result);
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  // Load landing content on mount
  useEffect(() => {
    const loadLandingContent = async () => {
      try {
        const content = await apiClient.getLandingContent();
        if (content && !content.error) {
          setLandingContent(content);
        }
      } catch (error) {
        console.log('Using default landing content');
      }
    };
    loadLandingContent();
  }, []);

  // Load projects and access requests when user is logged in
  useEffect(() => {
    if (currentUser) {
      loadProjects();
      loadAccessRequests();
      loadAllUsers();
    }
  }, [currentUser]);

  const normalizeProjectData = (project: any): Project => {
    const safeArray = (value: any): any[] => (Array.isArray(value) ? value : []);

    return {
      id: project.id || project.ID || `proj-${Date.now()}`,
      title: project.title || '',
      abstract: project.abstract || '',
      domains: safeArray(project.domains ?? []),
      year: project.year || '',
      license: project.license || '',
      techStack: safeArray(project.techStack ?? project.techstack),
      status: project.status || 'locked',
      owner: project.owner || '',
      ownerId: project.ownerId || project.ownerid || '',
      teamMembers: safeArray(project.teamMembers),
      uploadedFiles: safeArray(project.uploadedFiles ?? project.uploadedfiles),
      history: safeArray(project.history ?? project.project_history ?? []),
      createdAt: project.createdAt || project.createdat || new Date().toISOString(),
      lastUpdated: project.lastUpdated || project.lastupdated || new Date().toISOString(),
      approvedFacultyIds: safeArray(project.approvedFacultyIds ?? project.approvedfacultyids),
      approvalStatus: project.approvalStatus || project.approvalstatus || 'pending',
      readmeContent: project.readmeContent || project.readmecontent || '',
    };
  };

  const loadProjects = async () => {
    try {
      const data = await apiClient.getProjects();
      if (Array.isArray(data)) {
        setProjects(data.map(normalizeProjectData));
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const loadAccessRequests = async () => {
    try {
      const data = await apiClient.getAccessRequests();
      if (Array.isArray(data)) {
        setAccessRequests(data);
      }
    } catch (error) {
      console.error('Failed to load access requests:', error);
    }
  };

  const loadAllUsers = async () => {
    try {
      const data = await apiClient.getAllUsers();
      if (Array.isArray(data)) {
        setAllUsers(data);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView('dashboard');
    localStorage.removeItem(USER_STORAGE_KEY);
    setShowLogin(false);
  };

  const handleNavigate = (view: ViewType, projectId?: string) => {
    setCurrentView(view);
    if (projectId) {
      setSelectedProjectId(projectId);
    }
  };

  const handleCreateProject = async (project: Project) => {
    try {
      const result = await apiClient.createProject(project);
      if (result.error) throw new Error(result.error);
      // Refresh from backend to avoid stale local / mock state
      await loadProjects();
      setCurrentView('dashboard');
    } catch (error: any) {
      console.error('Failed to create project:', error);
      alert(`Failed to create project: ${error.message || error}`);
    }
  };

  const handleRequestAccess = async (projectId: string) => {
    if (!currentUser) return;
    try {
      const result = await apiClient.createAccessRequest(projectId, currentUser.id, currentUser.name);
      if (result.error) throw new Error(result.error);
      setAccessRequests((prevRequests) => [...prevRequests, result]);
    } catch (error) {
      console.error('Failed to request access:', error);
    }
  };



  const handleSaveFilesToProject = async (projectId: string, files: UploadedFile[]) => {
    try {
      const project = projects.find(p => p.id === projectId);
      if (!project) throw new Error('Project not found');

      const updatedFiles = [...(project.uploadedFiles || []), ...files];
      const newHistoryEntry = {
        id: `history-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        action: 'file_upload',
        author: currentUser?.name || 'unknown',
        details: `Uploaded ${files.length} file(s): ${files.map(f => f.name).join(', ')}`,
        timestamp: new Date().toISOString(),
        files: files.map(f => ({ id: f.id, name: f.name, size: f.size, type: f.type })),
      };
      const updatedHistory = [...(project.history || []), newHistoryEntry];

      // Retry logic for transient socket errors
      let attempts = 0;
      let result: any;
      while (attempts < 3) {
        result = await apiClient.updateProject(projectId, { uploadedFiles: updatedFiles, history: updatedHistory });
        if (!result.error) break;
        if (result.error.includes('10035') || result.error.includes('network')) {
          attempts += 1;
          console.warn(`Retrying save project (${attempts}) due to transient error:`, result.error);
          await new Promise(resolve => setTimeout(resolve, 800));
          continue;
        }
        break;
      }

      if (result.error) throw new Error(result.error);
      await loadProjects();
      alert('Files saved to project successfully.');
    } catch (error: any) {
      console.error('Failed to save file to project:', error);
      alert(`Failed to save file to project: ${error?.message || error}`);
    }
  };

  const handleSaveReadmeToProject = async (projectId: string, readmeContent: string) => {
    try {
      const project = projects.find(p => p.id === projectId);
      if (!project) throw new Error('Project not found');

      const trimmedReadme = readmeContent.trim();
      const newHistoryEntry = {
        id: `history-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        action: 'project_update',
        author: currentUser?.name || 'unknown',
        details: trimmedReadme ? 'Updated README.md' : 'Cleared README.md',
        timestamp: new Date().toISOString(),
        files: [{ name: 'README.md' }],
      };
      const updatedHistory = [...(project.history || []), newHistoryEntry];

      let attempts = 0;
      let result: any;
      while (attempts < 3) {
        result = await apiClient.updateProject(projectId, {
          readmeContent,
          history: updatedHistory,
        });
        if (!result.error) break;
        if (result.error.includes('10035') || result.error.includes('network')) {
          attempts += 1;
          await new Promise(resolve => setTimeout(resolve, 800));
          continue;
        }
        break;
      }

      if (result.error) throw new Error(result.error);
      await loadProjects();
      alert('README saved successfully.');
    } catch (error: any) {
      console.error('Failed to save README:', error);
      alert(`Failed to save README: ${error?.message || error}`);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      const result = await apiClient.approveAccessRequest(requestId);
      if (result.error) throw new Error(result.error);
      
      setAccessRequests(prevRequests => {
        const request = prevRequests.find(req => req.id === requestId);
        if (request) {
          setProjects(prevProjects =>
            prevProjects.map(proj =>
              proj.id === request.projectId
                ? { 
                    ...proj, 
                    approvedFacultyIds: [...(proj.approvedFacultyIds || []), request.facultyId]
                  }
                : proj
            )
          );
        }
        return prevRequests.map(req =>
          req.id === requestId ? { ...req, status: 'approved' as const } : req
        );
      });
    } catch (error) {
      console.error('Failed to approve request:', error);
      alert('Failed to approve request. Please try again.');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const result = await apiClient.rejectAccessRequest(requestId);
      if (result.error) throw new Error(result.error);
      setAccessRequests(prevRequests =>
        prevRequests.map(req =>
          req.id === requestId ? { ...req, status: 'rejected' as const } : req
        )
      );
    } catch (error) {
      console.error('Failed to reject request:', error);
      alert('Failed to reject request. Please try again.');
    }
  };

  const handleApproveProject = (projectId: string) => {
    setProjects(
      projects.map(proj =>
        proj.id === projectId ? { ...proj, approvalStatus: 'approved' as const } : proj
      )
    );
  };

  const handleRejectProject = (projectId: string) => {
    setProjects(
      projects.map(proj =>
        proj.id === projectId ? { ...proj, approvalStatus: 'rejected' as const } : proj
      )
    );
  };

  if (!currentUser) {
    if (!showLogin) {
      return <Landing onGetStarted={() => setShowLogin(true)} content={landingContent} />;
    }
    return <Login onLogin={handleLogin} onBack={() => setShowLogin(false)} />;
  }

  // Admin view
  if (currentUser.role === 'admin') {
    return (
      <AdminDashboard
        user={currentUser}
        landingContent={landingContent}
        onUpdateContent={setLandingContent}
        onLogout={handleLogout}
      />
    );
  }

  const selectedProject = selectedProjectId
    ? projects.find(p => p.id === selectedProjectId)
    : null;

  return (
    <div className="min-h-screen bg-slate-50">
      {currentView === 'dashboard' && (
        <Dashboard
          user={currentUser}
          projects={projects}
          setProjects={setProjects}
          accessRequests={accessRequests}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          onApproveRequest={handleApproveRequest}
          onRejectRequest={handleRejectRequest}
        />
      )}
      
      {currentView === 'create-project' && (
        <ProjectCreation
          user={currentUser}
          allUsers={allUsers}
          projects={projects}
          accessRequests={accessRequests}
          onNavigate={handleNavigate}
          onCreateProject={handleCreateProject}
          onLogout={handleLogout}
          onApproveRequest={handleApproveRequest}
          onRejectRequest={handleRejectRequest}
        />
      )}

      {currentView === 'project-detail' && selectedProject && (
        <ProjectDetail
          user={currentUser}
          project={selectedProject}
          projects={projects}
          accessRequests={accessRequests}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          onRequestAccess={handleRequestAccess}
          onApproveRequest={handleApproveRequest}
          onRejectRequest={handleRejectRequest}
          onSaveFiles={handleSaveFilesToProject}
          onSaveReadme={handleSaveReadmeToProject}
        />
      )}

      {currentView === 'profile' && (
        <Profile
          user={currentUser}
          projects={projects}
          accessRequests={accessRequests}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          onApproveRequest={handleApproveRequest}
          onRejectRequest={handleRejectRequest}
        />
      )}

      {currentView === 'settings' && (
        <Settings
          user={currentUser}
          projects={projects}
          accessRequests={accessRequests}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          onApproveRequest={handleApproveRequest}
          onRejectRequest={handleRejectRequest}
          onUpdateUser={handleUpdateUser}
        />
      )}
    </div>
  );
}

export default App;
