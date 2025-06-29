
import { supabase } from '@/integrations/supabase/client';

export interface Client {
  id: string;
  user_id: string;
  name: string;
  email?: string;
  phone?: string;
  case_number?: string;
  matter_type?: string;
  created_at: string;
  updated_at: string;
  archived: boolean;
}

export interface Folder {
  id: string;
  user_id: string;
  client_id: string;
  parent_folder_id?: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export const getClients = async (): Promise<Client[]> => {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('archived', false)
    .order('name');

  if (error) {
    throw new Error(`Failed to fetch clients: ${error.message}`);
  }

  return data || [];
};

export const createClient = async (clientData: Omit<Client, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'archived'>): Promise<Client> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('clients')
    .insert({
      ...clientData,
      user_id: user.id
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create client: ${error.message}`);
  }

  // Create default folders for the new client
  await createDefaultFolders(data.id);

  return data;
};

export const updateClient = async (id: string, updates: Partial<Client>): Promise<Client> => {
  const { data, error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update client: ${error.message}`);
  }

  return data;
};

export const deleteClient = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('clients')
    .update({ archived: true })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete client: ${error.message}`);
  }
};

const createDefaultFolders = async (clientId: string): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const defaultFolders = [
    'Pleadings',
    'Discovery',
    'Correspondence',
    'Court Orders',
    'Contracts',
    'Evidence'
  ];

  const folderInserts = defaultFolders.map(name => ({
    user_id: user.id,
    client_id: clientId,
    name
  }));

  const { error } = await supabase
    .from('folders')
    .insert(folderInserts);

  if (error) {
    console.error('Failed to create default folders:', error);
  }
};

export const getFolders = async (clientId: string, parentFolderId?: string): Promise<Folder[]> => {
  let query = supabase
    .from('folders')
    .select('*')
    .eq('client_id', clientId)
    .order('name');

  if (parentFolderId) {
    query = query.eq('parent_folder_id', parentFolderId);
  } else {
    query = query.is('parent_folder_id', null);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch folders: ${error.message}`);
  }

  return data || [];
};

export const createFolder = async (folderData: Omit<Folder, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Folder> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('folders')
    .insert({
      ...folderData,
      user_id: user.id
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create folder: ${error.message}`);
  }

  return data;
};

export const updateFolder = async (id: string, updates: Partial<Folder>): Promise<Folder> => {
  const { data, error } = await supabase
    .from('folders')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update folder: ${error.message}`);
  }

  return data;
};

export const deleteFolder = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('folders')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete folder: ${error.message}`);
  }
};
