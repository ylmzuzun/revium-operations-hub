import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MyWork = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Work</h1>
        <p className="text-muted-foreground mt-1">
          Your personal workspace
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Assigned to Me</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              No tasks assigned
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tasks I Created</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              No tasks created
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Watching</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              No tasks watched
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Due This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              No tasks due
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MyWork;
