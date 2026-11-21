import React, { useEffect, useMemo } from 'react';
import { UseFormRegisterReturn, UseFormSetValue } from 'react-hook-form';
import SearchableSelect from './ui/SearchableSelect';
import { getDistrictsByState, getAllStates } from '../data/indianStatesDistricts';

interface StateDistrictSelectorProps {
  stateValue?: string;
  districtValue?: string;
  stateRegister?: UseFormRegisterReturn;
  districtRegister?: UseFormRegisterReturn;
  setValue?: UseFormSetValue<any>;
  stateError?: string;
  districtError?: string;
  disabled?: boolean;
  stateLabel?: string;
  districtLabel?: string;
  required?: boolean;

  // Controlled component mode
  selectedState?: string;
  selectedDistrict?: string;
  onStateChange?: (state: string) => void;
  onDistrictChange?: (district: string) => void;
}

const StateDistrictSelector: React.FC<StateDistrictSelectorProps> = ({
  stateValue,
  districtValue,
  stateRegister,
  districtRegister,
  setValue,
  stateError,
  districtError,
  disabled = false,
  stateLabel = 'State',
  districtLabel = 'District',
  required = true,
  selectedState,
  selectedDistrict,
  onStateChange,
  onDistrictChange,
}) => {
  const rawState = stateValue ?? selectedState ?? '';
  const rawDistrict = districtValue ?? selectedDistrict ?? '';

  // Get all states for the dropdown
  const stateOptions = useMemo(() => {
    const states = getAllStates();
    return [
      { value: '', label: 'Select State' },
      ...states.map(state => ({ value: state, label: state }))
    ];
  }, []);

  // Canonical matched state (case-insensitive)
  const effectiveState = useMemo(() => {
    if (!rawState) return '';
    const match = stateOptions.find(opt => opt.value.toLowerCase() === rawState.toLowerCase());
    return match ? match.value : rawState;
  }, [rawState, stateOptions]);

  // Get districts based on selected state
  const districtOptions = useMemo(() => {
    if (!effectiveState) {
      return [{ value: '', label: 'Select District' }];
    }
    const districts = getDistrictsByState(effectiveState);
    return [
      { value: '', label: 'Select District' },
      ...districts.map(district => ({ value: district, label: district }))
    ];
  }, [effectiveState]);

  // Canonical matched district (case-insensitive)
  const effectiveDistrict = useMemo(() => {
    if (!rawDistrict) return '';
    const match = districtOptions.find(opt => opt.value.toLowerCase() === rawDistrict.toLowerCase());
    return match ? match.value : rawDistrict;
  }, [rawDistrict, districtOptions]);

  // Reset district when state changes
  useEffect(() => {
    if (effectiveState && effectiveDistrict) {
      const districts = getDistrictsByState(effectiveState);
      const isDistrictInState = districts.some(
        d => d.toLowerCase() === effectiveDistrict.toLowerCase()
      );
      if (!isDistrictInState) {
        if (districtRegister?.name && setValue) {
          setValue(districtRegister.name, '', { shouldValidate: true, shouldDirty: true });
        }
        if (districtRegister?.onChange) {
          const event = {
            target: { value: '', name: districtRegister.name },
          } as React.ChangeEvent<HTMLInputElement>;
          districtRegister.onChange(event);
        }
        if (onDistrictChange) {
          onDistrictChange('');
        }
      }
    } else if (!effectiveState && effectiveDistrict) {
      // If state is cleared, clear district too
      if (districtRegister?.name && setValue) {
        setValue(districtRegister.name, '', { shouldValidate: true, shouldDirty: true });
      }
      if (districtRegister?.onChange) {
        const event = {
          target: { value: '', name: districtRegister.name },
        } as React.ChangeEvent<HTMLInputElement>;
        districtRegister.onChange(event);
      }
      if (onDistrictChange) {
        onDistrictChange('');
      }
    }
  }, [effectiveState, effectiveDistrict, setValue, districtRegister?.name, districtRegister?.onChange, onDistrictChange]);

  const handleStateChange = (value: string) => {
    let canonicalVal = value;
    if (value) {
      const match = stateOptions.find(opt => opt.value.toLowerCase() === value.toLowerCase());
      if (match) {
        canonicalVal = match.value;
      }
    }

    if (stateRegister?.onChange) {
      const event = {
        target: {
          value: canonicalVal,
          name: stateRegister.name
        }
      } as React.ChangeEvent<HTMLInputElement>;
      stateRegister.onChange(event);
    }
    if (setValue && stateRegister?.name) {
      setValue(stateRegister.name, canonicalVal, { shouldValidate: !!canonicalVal, shouldDirty: true });
    }
    if (onStateChange) {
      onStateChange(canonicalVal);
    }
    // Clear district when state changes or is cleared
    if (!canonicalVal || canonicalVal.toLowerCase() !== effectiveState.toLowerCase()) {
      if (setValue && districtRegister?.name) {
        setValue(districtRegister.name, '', { shouldValidate: false, shouldDirty: true });
      }
      if (districtRegister?.onChange) {
        const event = {
          target: { value: '', name: districtRegister.name },
        } as React.ChangeEvent<HTMLInputElement>;
        districtRegister.onChange(event);
      }
      if (onDistrictChange) {
        onDistrictChange('');
      }
    }
  };

  const handleDistrictChange = (value: string) => {
    let canonicalVal = value;
    if (value && effectiveState) {
      const districts = getDistrictsByState(effectiveState);
      const match = districts.find(d => d.toLowerCase() === value.toLowerCase());
      if (match) {
        canonicalVal = match;
      }
    }

    if (districtRegister?.onChange) {
      const event = {
        target: {
          value: canonicalVal,
          name: districtRegister.name
        }
      } as React.ChangeEvent<HTMLInputElement>;
      districtRegister.onChange(event);
    }
    if (setValue && districtRegister?.name) {
      setValue(districtRegister.name, canonicalVal, { shouldValidate: true, shouldDirty: true });
    }
    if (onDistrictChange) {
      onDistrictChange(canonicalVal);
    }
  };

    return (
      <>
        <SearchableSelect
          label={stateLabel}
          options={stateOptions.filter(opt => opt.value !== '')} // Remove empty option for searchable
          value={effectiveState}
          onChange={handleStateChange}
          onBlur={stateRegister?.onBlur}
          name={stateRegister?.name || 'state'}
          ref={stateRegister?.ref}
          disabled={disabled}
          error={stateError}
          required={required}
          allowCustom={false}
          placeholder="Search or select state..."
          className="text-sm sm:text-base"
        />
        <SearchableSelect
          label={districtLabel}
          options={districtOptions.filter(opt => opt.value !== '')} // Remove empty option for searchable
          value={effectiveDistrict}
          onChange={handleDistrictChange}
          onBlur={districtRegister?.onBlur}
          name={districtRegister?.name || 'district'}
          ref={districtRegister?.ref}
          disabled={disabled || !effectiveState}
          error={districtError}
          required={required}
          allowCustom={false}
          placeholder="Search or select district..."
          className="text-sm sm:text-base"
        />
      </>
    );
  };

  export default StateDistrictSelector;

