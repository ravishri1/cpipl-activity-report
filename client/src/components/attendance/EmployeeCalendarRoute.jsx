import { useParams, useNavigate } from 'react-router-dom';
import EmployeeCalendarView from './EmployeeCalendarView';

export default function EmployeeCalendarRoute() {
  const { userId } = useParams();
  const navigate = useNavigate();

  return (
    <EmployeeCalendarView
      userId={parseInt(userId)}
      onBack={() => navigate('/admin/attendance')}
    />
  );
}
