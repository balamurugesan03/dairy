import { useParams } from 'react-router-dom';
import FarmerView from '../components/farmer/FarmerView';

const FarmerViewPage = () => {
  const { id } = useParams();
  return <FarmerView farmerId={id} />;
};

export default FarmerViewPage;
