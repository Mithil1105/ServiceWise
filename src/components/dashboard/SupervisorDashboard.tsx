import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Car, Wrench, Gauge, ArrowRight } from 'lucide-react';
import { useAssignedCarIdsForCurrentUser } from '@/hooks/use-car-assignments';
import { useCars } from '@/hooks/use-cars';
import { useNavigate } from 'react-router-dom';
import { formatCarLabel } from '@/lib/utils';

export default function SupervisorDashboard() {
  const navigate = useNavigate();
  const { data: cars = [], isLoading: carsLoading } = useCars();
  const { assignedCarIds, isRestricted, isLoading: assignedLoading } = useAssignedCarIdsForCurrentUser();
  const assignedCars = isRestricted && assignedCarIds
    ? cars.filter((car) => assignedCarIds.includes(car.id))
    : cars;
  const isLoading = carsLoading || assignedLoading;

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

  if (assignedCars.length === 0) {
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
          You have {assignedCars.length} car{assignedCars.length !== 1 ? 's' : ''} assigned to you
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
            <div className="text-2xl font-bold">{assignedCars.length}</div>
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
            {assignedCars.map((car) => (
              <Card
                key={car.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`/app/fleet/${car.id}`)}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{formatCarLabel(car)}</h3>
                      <p className="text-sm text-muted-foreground">{car.brand ?? ''} {car.model}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/app/services/new?car=${car.id}`);
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
                        navigate(`/app/odometer?car=${car.id}`);
                      }}
                    >
                      <Gauge className="h-3 w-3 mr-1" />
                      Odometer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
