/** An explicit switch prevents an unprovisioned database from replacing the preview. */
export const dataSource = import.meta.env.VITE_DATA_SOURCE === 'supabase' ? 'supabase' : 'sample'
export const isLiveData = dataSource === 'supabase'
