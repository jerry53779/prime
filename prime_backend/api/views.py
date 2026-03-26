from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
import json
import time
from datetime import datetime
import uuid
import os
import requests
from supabase import create_client, Client

# Retry helper for transient network/socket failures
def supabase_execute(action, retries=3, delay=1):
    last_error = None
    for attempt in range(1, retries + 1):
        try:
            return action()
        except Exception as e:
            last_error = e
            winerror = getattr(e, 'winerror', None)
            is_transient = (
                winerror == 10035
                or isinstance(e, requests.exceptions.RequestException)
                or isinstance(e, OSError)
            )
            if attempt < retries and is_transient:
                print(f"supabase_execute: transient error {e}, retry {attempt}/{retries}")
                time.sleep(delay)
                continue
            raise

# Initialize Supabase
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ========================
# AUTHENTICATION ENDPOINTS
# ========================

@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """Login endpoint"""
    username = request.data.get('username')
    password = request.data.get('password')
    role = request.data.get('role', 'student')
    
    if not username or not password:
        return Response({'error': 'Username and password required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        response = supabase.table('users').select('*').eq('username', username).execute()
        if response.data:
            user = response.data[0]
            if user.get('password') != password:
                return Response({'error': 'Invalid username or password'}, status=status.HTTP_401_UNAUTHORIZED)

            user_response = {
                'id': user['id'],
                'username': user['username'],
                'email': user.get('email', ''),
                'name': user.get('name', user['username']),
                'role': user.get('role', role)
            }
            return Response(user_response, status=status.HTTP_200_OK)

        return Response({'error': 'Invalid username or password'}, status=status.HTTP_401_UNAUTHORIZED)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """Register endpoint"""
    username = request.data.get('username')
    password = request.data.get('password')
    name = request.data.get('name')
    role = request.data.get('role', 'student')
    
    if not all([username, password, name]):
        return Response({'error': 'Username, password, and name required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        existing = supabase.table('users').select('*').eq('username', username).execute()
        if existing.data:
            return Response({'error': 'User already exists'}, status=status.HTTP_400_BAD_REQUEST)
        
        new_user = {
            'id': str(uuid.uuid4()),
            'username': username,
            'password': password,
            'name': name,
            'role': role,
            'created_at': datetime.utcnow().isoformat()
        }
        supabase.table('users').insert(new_user).execute()
        user_response = {
            'id': new_user['id'],
            'username': new_user['username'],
            'email': new_user.get('email', ''),
            'name': new_user['name'],
            'role': new_user['role']
        }
        return Response(user_response, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# ========================
# USERS ENDPOINTS
# ========================

@api_view(['GET'])
def get_user(request, user_id):
    """Get user by ID"""
    try:
        response = supabase.table('users').select('*').eq('id', user_id).execute()
        if response.data:
            return Response(response.data[0], status=status.HTTP_200_OK)
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_all_users(request):
    """Get all users"""
    try:
        response = supabase.table('users').select('*').execute()
        return Response(response.data, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_user(request, user_id):
    """Get user by ID"""
    try:
        response = supabase.table('users').select('*').eq('id', user_id).execute()
        if response.data:
            return Response(response.data[0], status=status.HTTP_200_OK)
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PUT'])
@permission_classes([AllowAny])
def update_user(request, user_id):
    """Update user endpoint"""
    try:
        # Get user from Supabase
        response = supabase.table('users').select('*').eq('id', user_id).execute()
        if not response.data:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        
        user = response.data[0]
        
        # Update fields
        updated_data = {}
        for field in ['username', 'email', 'name', 'role']:
            if field in request.data:
                updated_data[field] = request.data[field]
        
        if updated_data:
            supabase.table('users').update(updated_data).eq('id', user_id).execute()
            # Return updated user
            updated_user = supabase.table('users').select('*').eq('id', user_id).execute().data[0]
            user_response = {
                'id': updated_user['id'],
                'username': updated_user['username'],
                'email': updated_user.get('email', ''),
                'name': updated_user.get('name', updated_user['username']),
                'role': updated_user.get('role', 'student')
            }
            return Response(user_response, status=status.HTTP_200_OK)
        else:
            return Response({'error': 'No fields to update'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
@permission_classes([AllowAny])
def delete_user(request, user_id):
    """Delete user endpoint"""
    try:
        # Check if user exists
        response = supabase.table('users').select('*').eq('id', user_id).execute()
        if not response.data:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Delete all projects owned by the user
        projects_response = supabase.table('projects').select('id').eq('ownerid', user_id).execute()
        for project in projects_response.data:
            # Delete team members for each project
            supabase.table('team_members').delete().eq('project_id', project['id']).execute()
            # Delete the project
            supabase.table('projects').delete().eq('id', project['id']).execute()
        
        # Delete access requests where user is faculty
        supabase.table('access_requests').delete().eq('faculty_id', user_id).execute()
        
        # Delete the user
        supabase.table('users').delete().eq('id', user_id).execute()
        
        return Response({'message': 'User and all related data deleted'}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ========================
# PROJECTS ENDPOINTS
# ========================

def normalize_history(history):
    if isinstance(history, list):
        return history
    if isinstance(history, str):
        try:
            parsed = json.loads(history)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    return []


def normalize_project(project):
    return {
        'id': project.get('id'),
        'title': project.get('title'),
        'abstract': project.get('abstract'),
        'domains': project.get('domains') or project.get('domains', []),
        'year': project.get('year'),
        'license': project.get('license'),
        'techStack': project.get('techstack') or project.get('techStack') or [],
        'status': project.get('status'),
        'owner': project.get('owner'),
        'ownerId': project.get('ownerid') or project.get('ownerId'),
        'createdAt': project.get('createdat') or project.get('createdAt'),
        'lastUpdated': project.get('lastupdated') or project.get('lastUpdated'),
        'approvedFacultyIds': project.get('approvedfacultyids') or project.get('approvedFacultyIds') or [],
        'approvalStatus': project.get('approvalstatus') or project.get('approvalStatus'),
        'teamMembers': project.get('teamMembers', []),
        'uploadedFiles': normalize_uploaded_files(project.get('uploadedfiles') or project.get('uploadedFiles') or []),
        'history': normalize_history(project.get('history') or project.get('project_history') or []),
        'repositoryUrl': project.get('repository_url') or project.get('repositoryurl') or project.get('repositoryUrl'),
        'readmeContent': project.get('readmecontent') or project.get('readme_content') or project.get('readmeContent') or '',
    }


def normalize_uploaded_files(files):
    if isinstance(files, list):
        return files
    if isinstance(files, str):
        try:
            parsed = json.loads(files)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    return []


def normalize_email(value):
    return (value or '').strip().lower()


def looks_like_email(value):
    value = (value or '').strip()
    return '@' in value and '.' in value


def build_user_email_map():
    users_response = supabase_execute(lambda: supabase.table('users').select('id, name, email, username').execute())
    email_map = {}
    for user in users_response.data or []:
        email = normalize_email(user.get('email'))
        if email:
            email_map[email] = user
        username = normalize_email(user.get('username'))
        if username and looks_like_email(username):
            email_map[username] = user
    return email_map


def resolve_team_members(raw_team_members, owner_id=None, owner_name=None):
    team_members = raw_team_members or []
    email_map = build_user_email_map()
    resolved_members = []
    validation_errors = []

    owner_user = None
    if owner_id:
        owner_response = supabase_execute(lambda: supabase.table('users').select('id, name, email, username').eq('id', owner_id).execute())
        if owner_response.data:
            owner_user = owner_response.data[0]

    for index, member in enumerate(team_members):
        member_email = normalize_email(member.get('email'))
        member_name = (member.get('name') or '').strip()
        contribution = (member.get('contribution') or '').strip()
        role = member.get('role')

        if index == 0 and owner_user:
            owner_email = normalize_email(owner_user.get('email'))
            owner_username_email = normalize_email(owner_user.get('username')) if looks_like_email(owner_user.get('username')) else ''
            owner_contact_email = owner_email or owner_username_email
            if not owner_contact_email:
                validation_errors.append('Project owner must have an email in the users table before creating a project')
                continue

            resolved_members.append({
                'name': owner_user.get('name') or owner_name or member_name or owner_user.get('username') or 'Project Owner',
                'email': owner_contact_email,
                'contribution': contribution or 'Project Lead',
                'role': role or 'owner',
            })
            continue

        matched_user = email_map.get(member_email)
        if not matched_user:
            validation_errors.append(f"Team member email '{member.get('email', '')}' does not match any user in the database")
            continue

        resolved_members.append({
            'name': matched_user.get('name') or member_name or matched_user.get('username') or 'Team Member',
            'email': normalize_email(matched_user.get('email')) or normalize_email(matched_user.get('username')),
            'contribution': contribution,
            'role': role or 'contributor',
        })

    return resolved_members, validation_errors


@api_view(['GET'])
def get_projects(request):
    """Get all projects"""
    try:
        response = supabase_execute(lambda: supabase.table('projects').select('*').execute())
        projects = []
        for project in response.data:
            # Get team members
            team_response = supabase_execute(lambda: supabase.table('team_members').select('*').eq('project_id', project['id']).execute())
            project_data = normalize_project(project)
            project_data['teamMembers'] = team_response.data
            projects.append(project_data)
        return Response(projects, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def get_project(request, project_id):
    """Get project by ID"""
    try:
        response = supabase_execute(lambda: supabase.table('projects').select('*').eq('id', project_id).execute())
        if response.data:
            project = response.data[0]
            team_response = supabase_execute(lambda: supabase.table('team_members').select('*').eq('project_id', project_id).execute())
            project_data = normalize_project(project)
            project_data['teamMembers'] = team_response.data
            return Response(project_data, status=status.HTTP_200_OK)
        return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def create_project(request):
    """Create a new project"""
    try:
        status_value = request.data.get('status')
        if status_value == 'private':
            status_value = 'locked'
        existing_history = normalize_history(request.data.get('history') or request.data.get('project_history') or [])
        creation_event = {
            'id': str(uuid.uuid4()),
            'action': 'project_created',
            'author': request.data.get('owner') or request.data.get('ownerId') or 'unknown',
            'details': f"Project '{request.data.get('title', 'Untitled')}' created",
            'timestamp': datetime.utcnow().isoformat(),
            'files': []
        }
        project_history = [creation_event] + existing_history

        resolved_team_members, validation_errors = resolve_team_members(
            request.data.get('teamMembers', []),
            owner_id=request.data.get('ownerId') or request.data.get('ownerid'),
            owner_name=request.data.get('owner'),
        )
        if validation_errors:
            return Response({'error': ' | '.join(validation_errors)}, status=status.HTTP_400_BAD_REQUEST)

        project_data = {
            'id': str(uuid.uuid4()),
            'title': request.data.get('title'),
            'abstract': request.data.get('abstract'),
            'domains': request.data.get('domains', []),
            'year': request.data.get('year'),
            'license': request.data.get('license'),
            'techstack': request.data.get('techStack', []),
            'status': status_value or 'locked',
            'owner': request.data.get('owner'),
            'ownerid': request.data.get('ownerId') or request.data.get('ownerid'),
            'uploadedfiles': normalize_uploaded_files(request.data.get('uploadedFiles', []) or request.data.get('uploadedfiles', [])),
            'createdat': datetime.utcnow().isoformat(),
            'lastupdated': datetime.utcnow().isoformat(),
            'approvedfacultyids': request.data.get('approvedFacultyIds', []),
            'approvalstatus': request.data.get('approvalStatus', 'pending'),
            'repository_url': request.data.get('repositoryUrl') or request.data.get('repositoryurl'),
            'readmecontent': request.data.get('readmeContent') or request.data.get('readmecontent') or '',
            'history': project_history
        }

        insert_response = supabase_execute(lambda: supabase.table('projects').insert(project_data).execute())

        # Insert team members
        for member in resolved_team_members:
            member_data = {
                'id': str(uuid.uuid4()),
                'project_id': project_data['id'],
                'name': member.get('name'),
                'email': member.get('email'),
                'contribution': member.get('contribution')
            }
            supabase.table('team_members').insert(member_data).execute()

        # Use saved row if available to reflect DB values
        saved_project = insert_response.data[0] if insert_response and getattr(insert_response, 'data', None) else project_data

        created_project = normalize_project(saved_project)
        created_project['teamMembers'] = resolved_team_members
        created_project['uploadedFiles'] = project_data.get('uploadedfiles', [])
        created_project['readmeContent'] = project_data.get('readmecontent', '')

        return Response(created_project, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PUT'])
def update_project(request, project_id):
    """Update a project"""
    try:
        status_value = request.data.get('status')
        if status_value == 'private':
            status_value = 'locked'
        resolved_team_members = None

        if 'teamMembers' in request.data:
            existing_project = supabase_execute(lambda: supabase.table('projects').select('ownerid, owner').eq('id', project_id).execute())
            owner_id = existing_project.data[0].get('ownerid') if existing_project.data else None
            owner_name = existing_project.data[0].get('owner') if existing_project.data else None
            resolved_team_members, validation_errors = resolve_team_members(
                request.data.get('teamMembers', []),
                owner_id=owner_id,
                owner_name=owner_name,
            )
            if validation_errors:
                return Response({'error': ' | '.join(validation_errors)}, status=status.HTTP_400_BAD_REQUEST)

        project_data = {
            'title': request.data.get('title'),
            'abstract': request.data.get('abstract'),
            'domains': request.data.get('domains'),
            'year': request.data.get('year'),
            'license': request.data.get('license'),
            'techstack': request.data.get('techStack') or request.data.get('techstack'),
            'uploadedfiles': normalize_uploaded_files(request.data.get('uploadedFiles') or request.data.get('uploadedfiles') or []),
            'status': status_value or 'locked',
            'lastupdated': datetime.utcnow().isoformat(),
            'approvalstatus': request.data.get('approvalStatus') or request.data.get('approvalstatus'),
            'repository_url': request.data.get('repositoryUrl') or request.data.get('repositoryurl'),
            'readmecontent': request.data.get('readmeContent') if 'readmeContent' in request.data else request.data.get('readmecontent'),
        }

        history_input = request.data.get('history') or request.data.get('project_history')
        if history_input is not None:
            project_data['history'] = normalize_history(history_input)

        project_data = {k: v for k, v in project_data.items() if v is not None}

        response = supabase_execute(lambda: supabase.table('projects').update(project_data).eq('id', project_id).execute())
        if response.data:
            if resolved_team_members is not None:
                supabase_execute(lambda: supabase.table('team_members').delete().eq('project_id', project_id).execute())
                for member in resolved_team_members:
                    supabase_execute(lambda: supabase.table('team_members').insert({
                        'id': str(uuid.uuid4()),
                        'project_id': project_id,
                        'name': member.get('name'),
                        'email': member.get('email'),
                        'contribution': member.get('contribution'),
                    }).execute())

            updated = normalize_project(response.data[0])
            team_response = supabase.table('team_members').select('*').eq('project_id', project_id).execute()
            updated['teamMembers'] = team_response.data
            return Response(updated, status=status.HTTP_200_OK)
        return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['DELETE'])
def delete_project(request, project_id):
    """Delete a project"""
    try:
        # Delete team members first
        supabase.table('team_members').delete().eq('project_id', project_id).execute()
        
        # Delete project
        response = supabase.table('projects').delete().eq('id', project_id).execute()
        return Response({'message': 'Project deleted'}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_commit_history(request, project_id):
    """Get commit history for a project from GitHub"""
    try:
        # Get project to find repository URL
        response = supabase.table('projects').select('*').eq('id', project_id).execute()
        if not response.data:
            return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)
        
        project = response.data[0]
        repository_url = project.get('repositoryurl') or project.get('repositoryUrl')
        
        if not repository_url:
            return Response({'error': 'No repository URL configured for this project'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Extract owner/repo from GitHub URL
        # Handle various GitHub URL formats
        if 'github.com/' in repository_url:
            parts = repository_url.split('github.com/')[-1].split('/')
            if len(parts) >= 2:
                owner = parts[0]
                repo = parts[1].replace('.git', '')
                
                # GitHub API call
                api_url = f'https://api.github.com/repos/{owner}/{repo}/commits'
                headers = {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Prime-Backend/1.0'
                }
                
                # Add GitHub token if available (optional)
                github_token = os.getenv('GITHUB_TOKEN')
                if github_token:
                    headers['Authorization'] = f'token {github_token}'
                
                response = requests.get(api_url, headers=headers, params={'per_page': 20})
                
                if response.status_code == 200:
                    commits = response.json()
                    # Format commits for frontend
                    formatted_commits = []
                    for commit in commits:
                        formatted_commits.append({
                            'sha': commit['sha'][:7],  # Short SHA
                            'message': commit['commit']['message'],
                            'author': commit['commit']['author']['name'],
                            'date': commit['commit']['author']['date'],
                            'url': commit['html_url']
                        })
                    
                    return Response(formatted_commits, status=status.HTTP_200_OK)
                else:
                    return Response({'error': f'Failed to fetch commits: {response.status_code}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            else:
                return Response({'error': 'Invalid GitHub repository URL format'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({'error': 'Only GitHub repositories are supported'}, status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_projects_by_owner(request, owner_id):
    """Get projects by owner"""
    try:
        response = supabase.table('projects').select('*').eq('ownerid', owner_id).execute()
        projects = []
        for project in response.data:
            team_response = supabase.table('team_members').select('*').eq('project_id', project['id']).execute()
            project_data = normalize_project(project)
            project_data['teamMembers'] = team_response.data
            projects.append(project_data)
        return Response(projects, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# ========================
# ACCESS REQUESTS ENDPOINTS
# ========================

@api_view(['GET'])
def get_access_requests(request):
    """Get all access requests"""
    try:
        response = supabase.table('access_requests').select('*').execute()
        # Transform snake_case to camelCase for consistency
        transformed = []
        for req in response.data:
            transformed.append({
                'id': req.get('id'),
                'projectId': req.get('project_id'),
                'facultyId': req.get('faculty_id'),
                'facultyName': req.get('faculty_name'),
                'status': req.get('status'),
                'timestamp': req.get('timestamp')
            })
        return Response(transformed, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_access_requests_for_project(request, project_id):
    """Get access requests for a project"""
    try:
        response = supabase.table('access_requests').select('*').eq('project_id', project_id).execute()
        # Transform snake_case to camelCase for consistency
        transformed = []
        for req in response.data:
            transformed.append({
                'id': req.get('id'),
                'projectId': req.get('project_id'),
                'facultyId': req.get('faculty_id'),
                'facultyName': req.get('faculty_name'),
                'status': req.get('status'),
                'timestamp': req.get('timestamp')
            })
        return Response(transformed, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def create_access_request(request):
    """Create an access request"""
    try:
        project_id = request.data.get('projectId')
        faculty_id = request.data.get('facultyId')
        faculty_name = request.data.get('facultyName')
        
        if not all([project_id, faculty_id, faculty_name]):
            return Response(
                {'error': 'Missing required fields: projectId, facultyId, facultyName'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        access_request = {
            'id': str(uuid.uuid4()),
            'project_id': project_id,
            'faculty_id': faculty_id,
            'faculty_name': faculty_name,
            'status': 'pending',
            'timestamp': datetime.utcnow().isoformat()
        }
        
        print(f'Inserting access request: {access_request}')
        response = supabase.table('access_requests').insert(access_request).execute()
        print(f'Supabase response: {response}')
        
        # Return in format frontend expects
        return Response({
            'id': access_request['id'],
            'projectId': access_request['project_id'],
            'facultyId': access_request['faculty_id'],
            'facultyName': access_request['faculty_name'],
            'status': access_request['status'],
            'timestamp': access_request['timestamp']
        }, status=status.HTTP_201_CREATED)
    except Exception as e:
        print(f'Error creating access request: {str(e)}')
        import traceback
        traceback.print_exc()
        return Response({'error': f'Failed to create access request: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['PUT'])
def approve_access_request(request, request_id):
    """Approve an access request"""
    try:
        print(f'Approving access request: {request_id}')
        
        # Update request status
        supabase.table('access_requests').update({'status': 'approved'}).eq('id', request_id).execute()
        print(f'Updated request status to approved')
        
        # Get request details
        req_response = supabase.table('access_requests').select('*').eq('id', request_id).execute()
        if req_response.data:
            req = req_response.data[0]
            print(f'Request details: {req}')
            
            # Add faculty to approved list in projects table
            proj_id = req.get('project_id')
            faculty_id = req.get('faculty_id')
            print(f'Adding faculty {faculty_id} to project {proj_id} approvedFacultyIds')
            
            # Get current approved faculty IDs
            proj_response = supabase.table('projects').select('approvedfacultyids').eq('id', proj_id).execute()
            if proj_response.data:
                project = proj_response.data[0]
                approved_ids = project.get('approvedfacultyids', [])
                if not isinstance(approved_ids, list):
                    approved_ids = []
                
                print(f'Current approvedfacultyids: {approved_ids}')
                
                if faculty_id not in approved_ids:
                    approved_ids.append(faculty_id)
                    supabase.table('projects').update({'approvedfacultyids': approved_ids}).eq('id', proj_id).execute()
                    print(f'Updated approvedfacultyids to: {approved_ids}')
        
        return Response({'message': 'Request approved'}, status=status.HTTP_200_OK)
    except Exception as e:
        print(f'Error approving request: {str(e)}')
        import traceback
        traceback.print_exc()
        return Response({'error': f'Failed to approve request: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['PUT'])
def reject_access_request(request, request_id):
    """Reject an access request"""
    try:
        print(f'Rejecting access request: {request_id}')
        supabase.table('access_requests').update({'status': 'rejected'}).eq('id', request_id).execute()
        print(f'Updated request status to rejected')
        return Response({'message': 'Request rejected'}, status=status.HTTP_200_OK)
    except Exception as e:
        print(f'Error rejecting request: {str(e)}')
        import traceback
        traceback.print_exc()
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# ========================
# LANDING CONTENT ENDPOINTS
# ========================

@api_view(['GET'])
def get_landing_content(request):
    """Get landing page content"""
    try:
        response = supabase.table('landing_content').select('*').limit(1).execute()
        if response.data:
            return Response(response.data[0], status=status.HTTP_200_OK)
        return Response({'error': 'Content not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['PUT'])
def update_landing_content(request):
    """Update landing page content (admin only)"""
    try:
        content_data = {
            'title': request.data.get('title'),
            'subtitle': request.data.get('subtitle'),
            'description': request.data.get('description'),
            'features': request.data.get('features')
        }
        content_data = {k: v for k, v in content_data.items() if v is not None}
        
        # Get existing content
        existing = supabase.table('landing_content').select('*').limit(1).execute()
        if existing.data:
            response = supabase.table('landing_content').update(content_data).eq('id', existing.data[0]['id']).execute()
        else:
            content_data['id'] = str(uuid.uuid4())
            response = supabase.table('landing_content').insert(content_data).execute()
        
        return Response(content_data, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
