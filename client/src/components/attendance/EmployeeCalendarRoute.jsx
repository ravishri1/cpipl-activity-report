import { useParams, useNavigate } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import EmployeeCalendarView from './EmployeeCalendarView';

export default function EmployeeCalendarRoute() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { data: employees } = useFetch('/api/users', []);

  return (
    <EmployeeCalendarView
      userId={parseInt(userId)}
      onBack={() => navigate('/admin/attendance')}
      employees={employees}
      onEmployeeChange={(id) => navigate(`/admin/attendance/${id}`)}
    />
  );
}
