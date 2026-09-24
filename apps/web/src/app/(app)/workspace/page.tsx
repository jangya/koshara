import {WorkspacePage} from '@/components/workspace/workspace-page';

export default async function Page({searchParams}: {searchParams: Promise<{debug?: string}>}) {
  const {debug} = await searchParams;
  return <WorkspacePage debugEnabled={debug === 'true'} />;
}
