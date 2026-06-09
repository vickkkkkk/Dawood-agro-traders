const Card = ({
  children,
  className = '',
  gradient = false,
  hover = false,
  padding = true,
  compact = false,
  id,
  onClick,
}) => {
  return (
    <div
      id={id}
      onClick={onClick}
      className={`glass-card 
        ${gradient ? 'gradient-border' : ''}
        ${hover ? 'hover:cursor-pointer' : ''}
        ${!padding ? '!p-0' : (compact ? 'card-compact' : '')}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

export default Card;
