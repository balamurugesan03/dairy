import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { attendanceAPI, employeeAPI } from '../../services/api';
import { message } from '../../utils/toast';
import PageHeader from '../common/PageHeader';
import './MarkAttendance.css';

const MarkAttendance = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (employees.length > 0) {
      initializeAttendanceData();
    }
  }, [employees, selectedDate]);

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll({ status: 'Active', limit: 1000 });
      setEmployees(response.data || []);
    } catch (error) {
      message.error('Failed to fetch employees');
    }
  };

  const initializeAttendanceData = () => {
    const data = employees.map(emp => ({
      employee: emp._id,
      employeeNumber: emp.employeeNumber,
      name: emp.personalDetails?.name,
      date: selectedDate,
      checkIn: '',
      checkOut: '',
      status: 'Present',
      shift: 'General',
      workingHours: 0,
      overtimeHours: 0,
      breakTime: 0,
      remarks: ''
    }));
    setAttendanceData(data);
  };

  const handleAttendanceChange = (index, field, value) => {
    const newData = [...attendanceData];
    newData[index][field] = value;

    // Calculate working hours if both check-in and check-out are provided
    if (field === 'checkIn' || field === 'checkOut' || field === 'breakTime') {
      const record = newData[index];
      if (record.checkIn && record.checkOut) {
        const checkInTime = new Date(`${record.date}T${record.checkIn}`);
        const checkOutTime = new Date(`${record.date}T${record.checkOut}`);
        const diffMs = checkOutTime - checkInTime;
        const diffHours = diffMs / (1000 * 60 * 60);
        const breakHours = (record.breakTime || 0) / 60;
        record.workingHours = Math.max(0, diffHours - breakHours);
        record.overtimeHours = Math.max(0, record.workingHours - 8);

        // Auto-set status
        if (record.workingHours >= 8) {
          record.status = 'Present';
        } else if (record.workingHours >= 4) {
          record.status = 'Half Day';
        }
      }
    }

    setAttendanceData(newData);
  };

  const handleBulkAction = (action) => {
    const newData = attendanceData.map(record => ({
      ...record,
      status: action
    }));
    setAttendanceData(newData);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = attendanceData.map(record => ({
        employee: record.employee,
        date: record.date,
        checkIn: record.checkIn ? new Date(`${record.date}T${record.checkIn}`) : null,
        checkOut: record.checkOut ? new Date(`${record.date}T${record.checkOut}`) : null,
        status: record.status,
        shift: record.shift,
        workingHours: record.workingHours,
        overtimeHours: record.overtimeHours,
        breakTime: record.breakTime,
        remarks: record.remarks
      }));

      await attendanceAPI.bulkMark(payload);
      message.success('Attendance marked successfully');
      navigate('/hrm/attendance');
    } catch (error) {
      message.error(error.message || 'Failed to mark attendance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mark-attendance-container">
      <PageHeader
        title="Mark Attendance"
        subtitle="Record employee attendance"
        extra={
          <button
            className="btn btn-outline"
            onClick={() => navigate('/hrm/attendance')}
          >
            <i className="icon-arrow-left"></i> Back
          </button>
        }
      />

      {/* Date and Actions */}
      <div className="attendance-controls">
        <div className="date-control">
          <label>Attendance Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div className="bulk-actions">
          <label>Bulk Actions:</label>
          <button
            className="btn btn-success btn-sm"
            onClick={() => handleBulkAction('Present')}
          >
            Mark All Present
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => handleBulkAction('Absent')}
          >
            Mark All Absent
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => handleBulkAction('Week Off')}
          >
            Mark Week Off
          </button>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="table-container">
        <table className="mark-attendance-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Shift</th>
              <th>Check In</th>
              <th>Check Out</th>
              <th>Break (min)</th>
              <th>Working Hours</th>
              <th>Status</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {attendanceData.map((record, index) => (
              <tr key={record.employee}>
                <td>
                  <div className="employee-info">
                    <div className="employee-name">{record.name}</div>
                    <div className="employee-number">{record.employeeNumber}</div>
                  </div>
                </td>
                <td>
                  <select
                    value={record.shift}
                    onChange={(e) => handleAttendanceChange(index, 'shift', e.target.value)}
                  >
                    <option value="General">General</option>
                    <option value="Morning">Morning</option>
                    <option value="Evening">Evening</option>
                    <option value="Night">Night</option>
                  </select>
                </td>
                <td>
                  <input
                    type="time"
                    value={record.checkIn}
                    onChange={(e) => handleAttendanceChange(index, 'checkIn', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="time"
                    value={record.checkOut}
                    onChange={(e) => handleAttendanceChange(index, 'checkOut', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={record.breakTime}
                    onChange={(e) => handleAttendanceChange(index, 'breakTime', parseInt(e.target.value) || 0)}
                    min="0"
                    max="480"
                  />
                </td>
                <td className="working-hours">
                  {record.workingHours.toFixed(2)} hrs
                </td>
                <td>
                  <select
                    value={record.status}
                    onChange={(e) => handleAttendanceChange(index, 'status', e.target.value)}
                    className={`status-select status-${record.status.toLowerCase().replace(' ', '-')}`}
                  >
                    <option value="Present">Present</option>
                    <option value="Absent">Absent</option>
                    <option value="Half Day">Half Day</option>
                    <option value="Late">Late</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Holiday">Holiday</option>
                    <option value="Week Off">Week Off</option>
                  </select>
                </td>
                <td>
                  <input
                    type="text"
                    value={record.remarks}
                    onChange={(e) => handleAttendanceChange(index, 'remarks', e.target.value)}
                    placeholder="Add notes..."
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Submit Button */}
      <div className="submit-section">
        <button
          className="btn btn-primary btn-lg"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Attendance'}
        </button>
      </div>
    </div>
  );
};

export default MarkAttendance;
