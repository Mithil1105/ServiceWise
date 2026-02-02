import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Car, Wrench, Gauge, AlertTriangle, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useSupervisorAssignments } from '@/hooks/use-car-assignments';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

export default function SupervisorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: assignments = [], isLoading } = useSupervisorAssignments(user?.id);

  if (isLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading your assigned cars...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <Car className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Cars Assigned</h3>
            <p className="text-muted-foreground mt-2">
              You don't have any cars assigned to you yet. Contact your admin.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Assigned Cars</h1>
        <p className="text-muted-foreground">
          You have {assignments.length} car{assignments.length !== 1 ? 's' : ''} assigned to you
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Cars
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assignments.length}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/app/services/new')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Quick Action
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium">Log Service</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/app/odometer')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              Quick Action
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium">Update Odometer</div>
          </CardContent>
        </Card>
      </div>

      {/* Assigned Cars List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Your Vehicles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {assignments.map((assignment) => (
              <Card
                key={assignment.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`/fleet/${assignment.car_id}`)}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{assignment.cars.vehicle_number}</h3>
                      <p className="text-sm text-muted-foreground">{assignment.cars.model}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/services/new?car=${assignment.car_id}`);
                      }}
                    >
                      <Wrench className="h-3 w-3 mr-1" />
                      Service
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/odometer?car=${assignment.car_id}`);
                      }}
                    >
                      <Gauge className="h-3 w-3 mr-1" />
                      Odometer
                    </Button>
                  </div>
                  {assignment.notes && (
                    <p className="mt-2 text-xs text-muted-foreground truncate">
                      Note: {assignment.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
