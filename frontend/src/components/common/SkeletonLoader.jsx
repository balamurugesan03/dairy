import { Skeleton, Stack, Group } from '@mantine/core';

const SkeletonLoader = ({ type = 'text', count = 1, width, height, className = '' }) => {
  const skeletons = Array.from({ length: count }, (_, index) => index);

  const getSkeletonProps = () => {
    switch (type) {
      case 'text':
        return { height: height || 20, radius: 'sm', width: width || '100%' };
      case 'title':
        return { height: height || 32, radius: 'sm', width: width || '60%' };
      case 'circle':
        return { circle: true, height: height || 40, width: width || 40 };
      case 'rectangle':
        return { height: height || 100, radius: 'md', width: width || '100%' };
      case 'button':
        return { height: height || 36, radius: 'sm', width: width || 100 };
      default:
        return { height: height || 20, radius: 'sm', width: width || '100%' };
    }
  };

  const skeletonProps = getSkeletonProps();

  return (
    <Stack gap="sm" className={className}>
      {skeletons.map((_, index) => (
        <Skeleton key={index} {...skeletonProps} />
      ))}
    </Stack>
  );
};

export const TableSkeleton = ({ rows = 5, columns = 5 }) => {
  return (
    <Stack gap="md">
      {/* Header */}
      <Group gap="md" wrap="nowrap">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} height={24} width="100%" />
        ))}
      </Group>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <Group key={rowIndex} gap="md" wrap="nowrap">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} height={20} width="100%" />
          ))}
        </Group>
      ))}
    </Stack>
  );
};

export const CardSkeleton = () => {
  return (
    <Stack gap="md">
      <Skeleton height={32} width="60%" />
      <Skeleton height={16} width="80%" />
      <Skeleton height={16} width="80%" />
      <Skeleton height={16} width="80%" />
      <Group gap="sm" mt="md">
        <Skeleton height={36} width={100} />
        <Skeleton height={36} width={100} />
      </Group>
    </Stack>
  );
};

export default SkeletonLoader;
