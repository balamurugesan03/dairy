import { useParams } from 'react-router-dom';
import FarmerForm from '../components/farmer/FarmerForm';

const FarmerFormPage = () => {
  const { id } = useParams();
  return <FarmerForm farmerId={id} />;
};

export default FarmerFormPage;
