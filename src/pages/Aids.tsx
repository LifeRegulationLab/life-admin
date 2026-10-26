import { Link, Navigate } from 'react-router';
import { StuckPanel } from '../components/aids/Stuck';
import { Empty, Page } from '../components/ui';
import { lastTouched } from '../lib/logic/aids';
import { useStore } from '../lib/store/StoreProvider';

/** Where was I?: opens the thing you were part way through most recently, on the step you reached. */
export function WhereWasIPage() {
  const { data } = useStore();
  const item = lastTouched(data.items);
  if (item) return <Navigate to={`/item/${item.id}`} replace />;
  return (
    <Page title="Where was I?" back="/">
      <Empty>Nothing is part way through. Everything you started is either done or waiting for a reply.</Empty>
      <Link to="/" className="btn">
        Back to Today
      </Link>
    </Page>
  );
}

/** What is stopping me?: for the thing you were part way through, or in general when there is none. */
export function StuckPage() {
  const { data } = useStore();
  const item = lastTouched(data.items);
  if (item) return <Navigate to={`/item/${item.id}?view=stuck`} replace />;
  return (
    <Page title="Stuck?" back="/">
      <StuckPanel />
    </Page>
  );
}
