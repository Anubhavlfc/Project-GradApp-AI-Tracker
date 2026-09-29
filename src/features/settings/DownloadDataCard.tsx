import { Alert, Button, Card, CardBody, CardHeader } from '@/components/ui';
import { settingsErrorMessage, useDownloadMyData } from './hooks';

/** A copy of everything the person has stored, as one file on their own device. */
export function DownloadDataCard() {
  const download = useDownloadMyData();
  return (
    <Card>
      <CardHeader title="Your data" description="Keep a copy of everything you've stored here." />
      <CardBody className="space-y-4">
        <p className="text-fg-muted">
          The file holds your programs, checklists, recommenders and letter requests, funding,
          documents, tasks, notes and recent activity. It is created on this device and goes nowhere
          else.
        </p>
        {download.isError ? (
          <Alert kind="danger" title="Couldn't prepare your file">
            {settingsErrorMessage(download.error)}
          </Alert>
        ) : null}
        {download.isSuccess ? <Alert kind="success" title="Your file was downloaded." /> : null}
        <Button loading={download.isPending} onClick={() => download.mutate()}>
          {download.isPending ? 'Preparing…' : 'Download my data'}
        </Button>
      </CardBody>
    </Card>
  );
}
