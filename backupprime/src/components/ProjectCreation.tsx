import { useState } from 'react';
import { X, Plus, Trash2, ArrowLeft, Globe, Lock } from 'lucide-react';
import { User, Project, TeamMember, ViewType, AccessRequest, UploadedFile } from '../App';
import { Sidebar } from './Sidebar';
import { NotificationPanel } from './NotificationPanel';
import { FileUploadSection } from './FileUploadSection';

interface ProjectCreationProps {
  user: User;
  allUsers: User[];
  projects: Project[];
  accessRequests: AccessRequest[];
  onNavigate: (view: ViewType) => void;
  onCreateProject: (project: Project) => void | Promise<void>;
  onLogout: () => void;
  onApproveRequest: (requestId: string) => void;
  onRejectRequest: (requestId: string) => void;
}

export function ProjectCreation({ 
  user, 
  allUsers,
  projects,
  accessRequests,
  onNavigate, 
  onCreateProject, 
  onLogout,
  onApproveRequest,
  onRejectRequest
}: ProjectCreationProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [title, setTitle] = useState('');
  const [abstract, setAbstract] = useState('');
  const [domains, setDomains] = useState<string[]>([]);
  const [year, setYear] = useState('2024-25');
  const [license, setLicense] = useState('MIT');
  const [techStack, setTechStack] = useState<string[]>([]);
  const userEmail = user.email?.trim() || user.username || '';

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    { name: user.name, email: userEmail, contribution: 'Project Lead', role: 'owner' }
  ]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [teamMemberErrors, setTeamMemberErrors] = useState<Record<number, string>>({});
  
  const [domainInput, setDomainInput] = useState('');
  const [techInput, setTechInput] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [repositoryUrl, setRepositoryUrl] = useState('');

  const domainOptions = ['AI', 'Web', 'Mobile', 'IoT', 'Blockchain', 'ML', 'NLP', 'VR', 'AR', 'Cloud', 'Security', 'Data Science'];
  const yearOptions = ['2024-25', '2023-24', '2022-23', '2021-22'];
  const licenseOptions = ['MIT', 'Apache 2.0', 'GPL-3.0', 'BSD', 'Proprietary'];
  const normalizeEmail = (value: string) => value.trim().toLowerCase();
  const looksLikeEmail = (value?: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || '').trim());

  const findUserByEmail = (email: string) =>
    allUsers.find(candidate => {
      const candidateEmail = normalizeEmail(candidate.email || '');
      const candidateUsernameEmail = looksLikeEmail(candidate.username) ? normalizeEmail(candidate.username) : '';
      const targetEmail = normalizeEmail(email);
      return candidateEmail === targetEmail || candidateUsernameEmail === targetEmail;
    });

  const handleAddDomain = (domain: string) => {
    if (domain && !domains.includes(domain)) {
      setDomains([...domains, domain]);
    }
    setDomainInput('');
  };

  const handleAddTech = () => {
    if (techInput && !techStack.includes(techInput)) {
      setTechStack([...techStack, techInput]);
      setTechInput('');
    }
  };

  const handleAddTeamMember = () => {
    setTeamMembers([...teamMembers, { name: '', email: '', contribution: '', role: 'contributor' }]);
  };

  const handleUpdateTeamMember = (index: number, field: keyof TeamMember, value: string) => {
    const updated = [...teamMembers];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'email' && index > 0) {
      const matchedUser = findUserByEmail(value);
      if (matchedUser) {
        updated[index] = {
          ...updated[index],
          email: matchedUser.email || (looksLikeEmail(matchedUser.username) ? matchedUser.username : value),
          name: matchedUser.name || updated[index].name,
        };
        setTeamMemberErrors(prev => {
          const next = { ...prev };
          delete next[index];
          return next;
        });
      } else if (value.trim()) {
        setTeamMemberErrors(prev => ({
          ...prev,
          [index]: 'No user found with this email in the database.',
        }));
      } else {
        setTeamMemberErrors(prev => {
          const next = { ...prev };
          delete next[index];
          return next;
        });
      }
    }

    setTeamMembers(updated);
  };

  const handleRemoveTeamMember = (index: number) => {
    if (index === 0) return; // Can't remove project lead
    setTeamMembers(teamMembers.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Form submitted with data:', {
      title,
      abstract,
      domains,
      year,
      license,
      teamMembers,
      uploadedFiles
    });

    // Basic validation
    if (!title.trim() || !abstract.trim() || domains.length === 0 || !year || !license) {
      alert('Please fill in all required fields');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (teamMembers.length === 0 || teamMembers.some(m => !m.name.trim() || !m.email.trim() || !m.contribution.trim() || !m.role)) {
      alert('Please fill in all team member details');
      return;
    }
    if (teamMembers.some(m => !emailRegex.test(m.email.trim()))) {
      alert('Please enter valid email addresses for all team members');
      return;
    }

    const invalidMembers = teamMembers
      .slice(1)
      .filter(member => !findUserByEmail(member.email));
    if (invalidMembers.length > 0) {
      alert('Each added team member email must match an existing user email in the database');
      return;
    }

    const normalizedUserEmail = user.email?.trim() || user.username || '';

    const normalizedTeamMembers = teamMembers.map((member, index) => {
      if (index === 0) {
        return {
          ...member,
          email: normalizedUserEmail,
          name: member.name || user.name,
          contribution: member.contribution || 'Project Lead',
        };
      }
      const matchedUser = findUserByEmail(member.email);
      return {
        ...member,
        name: matchedUser?.name || member.name,
        email: matchedUser?.email || (matchedUser && looksLikeEmail(matchedUser.username) ? matchedUser.username : member.email),
      };
    });

    const newProject: Project = {
      id: `proj-${Date.now()}`,
      title: title.trim(),
      abstract: abstract.trim(),
      domains,
      year,
      license,
      techStack,
      status: isPublic ? 'public' : 'locked',
      owner: user.name,
      ownerId: user.id,
      teamMembers: normalizedTeamMembers,
      uploadedFiles: uploadedFiles,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      repositoryUrl: repositoryUrl.trim() || undefined,
    };

    console.log('Creating project:', newProject);

    try {
      await onCreateProject(newProject);
      console.log('Project created successfully');
    } catch (error) {
      console.error('Failed to create project:', error);
      alert('Failed to create project. Please try again.');
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar
        user={user}
        currentView="create-project"
        notificationCount={accessRequests.filter(req => 
          req.status === 'pending' && 
          projects.find(p => p.id === req.projectId && p.ownerId === user.id)
        ).length}
        onNavigate={(view) => {
          if (view === 'notifications') {
            setShowNotifications(!showNotifications);
          } else {
            onNavigate(view);
          }
        }}
        onLogout={onLogout}
      />

      <div className="flex-1 overflow-y-auto bg-slate-50">
        <div className="max-w-4xl mx-auto p-8">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => onNavigate('dashboard')}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-4 font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Create New Project</h1>
            <p className="text-slate-600">Share your academic project with the community</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-8 space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Project Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                placeholder="e.g., AI-Powered Student Assistant"
                required
              />
            </div>

            {/* Abstract */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Abstract *
              </label>
              <textarea
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition resize-none"
                placeholder="Provide a brief description of your project, its goals, and key features..."
                required
              />
            </div>

            {/* Domain Tags */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Domain Tags *
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {domains.map(domain => (
                  <span
                    key={domain}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg font-medium"
                  >
                    {domain}
                    <button
                      type="button"
                      onClick={() => setDomains(domains.filter(d => d !== domain))}
                      className="hover:bg-indigo-200 rounded p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <select
                  value={domainInput}
                  onChange={(e) => {
                    setDomainInput(e.target.value);
                    handleAddDomain(e.target.value);
                  }}
                  className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                >
                  <option value="">Select a domain...</option>
                  {domainOptions.filter(d => !domains.includes(d)).map(domain => (
                    <option key={domain} value={domain}>{domain}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Project Visibility */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Project Visibility *
              </label>
              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    id="public"
                    name="visibility"
                    type="radio"
                    checked={isPublic}
                    onChange={() => setIsPublic(true)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <label htmlFor="public" className="ml-3 block text-sm font-medium text-slate-700">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-green-600" />
                      <span>Public</span>
                    </div>
                    <p className="text-slate-500 text-xs mt-1">Anyone can view and access this project</p>
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="private"
                    name="visibility"
                    type="radio"
                    checked={!isPublic}
                    onChange={() => setIsPublic(false)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <label htmlFor="private" className="ml-3 block text-sm font-medium text-slate-700">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-600" />
                      <span>Private</span>
                    </div>
                    <p className="text-slate-500 text-xs mt-1">Only team members can view and access this project</p>
                  </label>
                </div>
              </div>
            </div>

            {/* Academic Year & License */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Academic Year *
                </label>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  required
                >
                  {yearOptions.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  License Type *
                </label>
                <select
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  required
                >
                  {licenseOptions.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tech Stack */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Tech Stack
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {techStack.map(tech => (
                  <span
                    key={tech}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-medium"
                  >
                    {tech}
                    <button
                      type="button"
                      onClick={() => setTechStack(techStack.filter(t => t !== tech))}
                      className="hover:bg-slate-200 rounded p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={techInput}
                  onChange={(e) => setTechInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTech())}
                  className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  placeholder="e.g., React, Python, TensorFlow..."
                />
                <button
                  type="button"
                  onClick={handleAddTech}
                  className="px-6 py-3 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Team Members */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Team Members *
              </label>
              <p className="text-sm text-slate-600 mb-4">
                Add team members and specify their contributions for external viewers
              </p>
              <div className="space-y-4">
                {teamMembers.map((member, index) => (
                  <div key={index} className="flex gap-3 items-start p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex-1 space-y-3">
                      <input
                        type="text"
                        value={member.name}
                        onChange={(e) => handleUpdateTeamMember(index, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                        placeholder="Name"
                        disabled={index === 0}
                        required
                      />
                      <input
                        type="email"
                        value={member.email}
                        onChange={(e) => handleUpdateTeamMember(index, 'email', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                        placeholder="Email"
                        disabled={index === 0}
                        required
                      />
                      {index > 0 && teamMemberErrors[index] && (
                        <p className="text-xs text-red-600">{teamMemberErrors[index]}</p>
                      )}
                      {index > 0 && !teamMemberErrors[index] && member.email.trim() && findUserByEmail(member.email) && (
                        <p className="text-xs text-green-600">
                          Email verified with {findUserByEmail(member.email)?.name || 'existing user'} in the database.
                        </p>
                      )}
                      <select
                        value={member.role}
                        onChange={(e) => handleUpdateTeamMember(index, 'role', e.target.value)}
                        className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                      >
                        <option value="owner">Owner</option>
                        <option value="lead">Lead</option>
                        <option value="developer">Developer</option>
                        <option value="designer">Designer</option>
                        <option value="researcher">Researcher</option>
                        <option value="contributor">Contributor</option>
                      </select>
                      <input
                        type="text"
                        value={member.contribution}
                        onChange={(e) => handleUpdateTeamMember(index, 'contribution', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                        placeholder="Contribution (e.g., Backend API Development)"
                        required
                      />
                    </div>
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTeamMember(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleAddTeamMember}
                className="mt-3 flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium"
              >
                <Plus className="w-5 h-5" />
                Add Team Member
              </button>
            </div>

            {/* File Upload */}
            <FileUploadSection 
              uploadedFiles={uploadedFiles}
              onFilesChange={setUploadedFiles}
            />

            {/* Project Visibility */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-4">
                Project Visibility *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className={`relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  !isPublic 
                    ? 'border-indigo-500 bg-indigo-50' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="visibility"
                    value="private"
                    checked={!isPublic}
                    onChange={() => setIsPublic(false)}
                    className="sr-only"
                  />
                  <div className="flex items-center gap-3 mb-2">
                    <Lock className="w-5 h-5 text-slate-600" />
                    <span className="font-medium text-slate-700">Private</span>
                  </div>
                  <p className="text-sm text-slate-600">
                    Only team members can view and access this project. Requires approval for new members to join.
                  </p>
                </label>

                <label className={`relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  isPublic 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="visibility"
                    value="public"
                    checked={isPublic}
                    onChange={() => setIsPublic(true)}
                    className="sr-only"
                  />
                  <div className="flex items-center gap-3 mb-2">
                    <Globe className="w-5 h-5 text-slate-600" />
                    <span className="font-medium text-slate-700">Public</span>
                  </div>
                  <p className="text-sm text-slate-600">
                    Anyone can view this project. Team members can still contribute and manage the repository.
                  </p>
                </label>
              </div>
            </div>

            {/* Repository URL */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Repository URL (Optional)
              </label>
              <input
                type="url"
                value={repositoryUrl}
                onChange={(e) => setRepositoryUrl(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                placeholder="https://github.com/username/repository"
              />
              <p className="text-sm text-slate-500 mt-1">
                Link to your GitHub repository to display commit history in the timeline.
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-6">
              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/30"
              >
                Create Project
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Notification Panel */}
      {showNotifications && (
        <NotificationPanel
          user={user}
          accessRequests={accessRequests}
          projects={projects}
          onApprove={onApproveRequest}
          onReject={onRejectRequest}
          onClose={() => setShowNotifications(false)}
        />
      )}
    </div>
  );
}
